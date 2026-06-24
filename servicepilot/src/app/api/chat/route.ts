import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  buildSystemPrompt,
  detectEmergency,
  extractBooking,
  generateAiReply,
  type ChatTurn,
} from "@/lib/ai";
import { createNotification } from "@/lib/notifications";
import { rateLimit } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/request-ip";

const bodySchema = z.object({
  businessId: z.string().min(1),
  sessionId: z.string().min(1).max(200).nullish(),
  message: z.string().min(1).max(5000),
  contact: z
    .object({
      name: z.string().max(200).optional(),
      phone: z.string().max(50).optional(),
      email: z.string().max(200).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { businessId, sessionId, message, contact } = parsed.data;

  const rl = rateLimit({
    key: "chat:" + businessId + ":" + getRequestIp(req),
    limit: 30,
    windowMs: 60000,
  });
  if (rl.ok === false) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Locked tenants (PENDING payment / SUSPENDED) get no AI service.
  if (business.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "This assistant is currently unavailable." },
      { status: 403 },
    );
  }
  const aiSetting = await prisma.aiSetting.findUnique({
    where: { businessId },
  });

  const businessServices = await prisma.service.findMany({
    where: { businessId, active: true },
    select: { name: true, niche: true, basePrice: true },
    orderBy: { name: "asc" },
  });
  const promptServices = businessServices.map((s) => ({
    name: s.name,
    niche: s.niche,
    basePrice: s.basePrice != null ? Number(s.basePrice) : null,
  }));

  const session = sessionId || "web_" + Math.random().toString(36).slice(2, 12);

  let conversation = await prisma.conversation.findFirst({
    where: {
      businessId,
      channel: "WEB_CHAT",
      externalRef: session,
      status: { notIn: ["LOST", "COMPLETED"] },
    },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId,
        channel: "WEB_CHAT",
        status: "AI_HANDLING",
        externalRef: session,
        aiActive: true,
      },
    });
  }

  const emergency = detectEmergency(
    message,
    aiSetting?.emergencyKeywords ?? [],
  );

  await prisma.message.create({
    data: {
      businessId,
      conversationId: conversation.id,
      sender: "CUSTOMER",
      content: message,
      metadata: contact ? { contact } : undefined,
    },
  });

  let status = conversation.status;
  if (emergency.isEmergency && status !== "BOOKED") {
    status = "HUMAN_NEEDED";
    await createNotification({
      businessId,
      type: "HUMAN_HANDOFF",
      title: "Emergency lead needs attention",
      body:
        'A web chat visitor mentioned "' +
        emergency.keyword +
        '". Flagged for immediate human follow-up.',
      metadata: {
        conversationId: conversation.id,
        keyword: emergency.keyword,
      },
    });
    await prisma.message.create({
      data: {
        businessId,
        conversationId: conversation.id,
        sender: "SYSTEM",
        content:
          'Emergency keyword detected ("' +
          emergency.keyword +
          '"). Flagged for immediate human attention.',
      },
    });
  }

  if (!conversation.aiActive) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status },
    });
    return NextResponse.json({
      sessionId: session,
      conversationId: conversation.id,
      reply: null,
      handoff: true,
      emergency: emergency.isEmergency,
      booked: false,
      jobId: null,
      status,
    });
  }

  const recent = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  const history: ChatTurn[] = recent
    .filter((m) => m.sender === "CUSTOMER" || m.sender === "AI")
    .map((m) => ({
      role: m.sender === "CUSTOMER" ? "user" : "assistant",
      content: m.content,
    }));

  const systemPrompt =
    buildSystemPrompt(business, aiSetting, promptServices) +
    (emergency.isEmergency
      ? "\nIMPORTANT: The customer's last message may describe an emergency. Respond with urgency and reassurance, and tell them a team member is being alerted now."
      : "");

  const reply = await generateAiReply({ systemPrompt, history });

  await prisma.message.create({
    data: {
      businessId,
      conversationId: conversation.id,
      sender: "AI",
      content: reply,
    },
  });

  // Attempt to turn a confirmed conversation into a real Job + Customer.
  let bookedJobId: string | null = null;
  let bookedCustomerId: string | null = null;
  const bookingEnabled = aiSetting?.bookingEnabled !== false;
  const userTurns = history.filter((h) => h.role === "user").length;
  if (
    bookingEnabled &&
    !emergency.isEmergency &&
    status !== "BOOKED" &&
    userTurns >= 2
  ) {
    const existingJob = await prisma.job.findUnique({
      where: { conversationId: conversation.id },
    });
    if (!existingJob) {
      const extraction = await extractBooking([
        ...history,
        { role: "assistant", content: reply },
      ]);
      if (extraction.readyToBook) {
        let customerId = conversation.customerId ?? null;
        if (!customerId) {
          const existingCustomer = extraction.phone
            ? await prisma.customer.findFirst({
                where: { businessId, phone: extraction.phone },
              })
            : null;
          const customer =
            existingCustomer ??
            (await prisma.customer.create({
              data: {
                businessId,
                name: extraction.customerName || null,
                phone: extraction.phone || null,
                address: extraction.address || null,
              },
            }));
          customerId = customer.id;
        }
        bookedCustomerId = customerId;
        const noteParts = [
          extraction.preferredTime
            ? "Preferred time: " + extraction.preferredTime
            : "",
          "Booked via AI web chat.",
        ].filter(Boolean);
        let scheduledAt: Date | null = null;
        if (extraction.preferredDateIso) {
          const dt = new Date(extraction.preferredDateIso);
          if (!Number.isNaN(dt.getTime())) scheduledAt = dt;
        }
        const job = await prisma.job.create({
          data: {
            businessId,
            customerId,
            conversationId: conversation.id,
            title: extraction.problemSummary || "Web chat booking request",
            problem: extraction.problemSummary || null,
            address: extraction.address || null,
            urgency: extraction.urgency,
            status: "BOOKED",
            scheduledAt,
            notes: noteParts.join(" "),
          },
        });
        bookedJobId = job.id;
        status = "BOOKED";
        await createNotification({
          businessId,
          type:
            extraction.urgency === "EMERGENCY" ? "URGENT_LEAD" : "NEW_BOOKING",
          title:
            (extraction.urgency === "EMERGENCY"
              ? "Urgent booking: "
              : "New booking: ") +
            (extraction.problemSummary || "Web chat request"),
          body:
            (extraction.customerName || "A customer") +
            " booked via the AI web chat" +
            (extraction.preferredTime
              ? " for " + extraction.preferredTime
              : "") +
            ".",
          metadata: {
            jobId: job.id,
            conversationId: conversation.id,
            source: "WEB_CHAT",
          },
        });
        await prisma.message.create({
          data: {
            businessId,
            conversationId: conversation.id,
            sender: "SYSTEM",
            content: "Booking created from chat (Job " + job.id + ").",
          },
        });
      }
    }
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      status,
      ...(bookedCustomerId && !conversation.customerId
        ? { customerId: bookedCustomerId }
        : {}),
    },
  });

  return NextResponse.json({
    sessionId: session,
    conversationId: conversation.id,
    reply,
    handoff: false,
    emergency: emergency.isEmergency,
    booked: Boolean(bookedJobId),
    jobId: bookedJobId,
    status,
  });
}
