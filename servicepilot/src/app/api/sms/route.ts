import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildSystemPrompt,
  detectEmergency,
  extractBooking,
  generateAiReply,
  type ChatTurn,
} from "@/lib/ai";
import { createNotification } from "@/lib/notifications";
import { escapeXml } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xml(body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function messageTwiml(text: string): string {
  return "<Response><Message>" + escapeXml(text) + "</Message></Response>";
}

// Twilio posts an inbound SMS here when a customer texts the business number.
// We run it through the same AI brain as web chat and voice, reply by SMS, and
// persist the thread as an SMS conversation keyed by the customer's phone
// number (Conversation.externalRef) so it continues across messages.
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId") || "";

  const form = await req.formData().catch(() => null);
  const body = ((form?.get("Body") as string) || "").trim();
  const from = (form?.get("From") as string) || "";

  const business = businessId
    ? await prisma.business.findUnique({ where: { id: businessId } })
    : null;
  if (!business || business.status !== "ACTIVE") {
    return xml(
      messageTwiml(
        "Sorry, this text assistant is not available right now. Please try again later.",
      ),
    );
  }

  // No sender or empty message: greet and ask how we can help.
  if (!from || !body) {
    return xml(
      messageTwiml(
        "Hi! Thanks for texting " +
          business.name +
          ". How can we help you today?",
      ),
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

  let conversation = await prisma.conversation.findFirst({
    where: {
      businessId,
      channel: "SMS",
      externalRef: from,
      status: { notIn: ["LOST", "COMPLETED"] },
    },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId,
        channel: "SMS",
        status: "AI_HANDLING",
        externalRef: from,
        aiActive: true,
      },
    });
  }

  const emergency = detectEmergency(body, aiSetting?.emergencyKeywords ?? []);

  await prisma.message.create({
    data: {
      businessId,
      conversationId: conversation.id,
      sender: "CUSTOMER",
      content: body,
      metadata: from ? { from } : undefined,
    },
  });

  let status = conversation.status;
  if (emergency.isEmergency && status !== "BOOKED") {
    status = "HUMAN_NEEDED";
    await createNotification({
      businessId,
      type: "HUMAN_HANDOFF",
      title: "Emergency text needs attention",
      body:
        'A texting customer mentioned "' +
        emergency.keyword +
        '". Flagged for immediate human follow-up.',
      metadata: {
        conversationId: conversation.id,
        keyword: emergency.keyword,
        from,
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
          '") over SMS. Flagged for immediate human attention.',
      },
    });
  }

  // A human has taken over this conversation.
  if (!conversation.aiActive) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status },
    });
    return xml(
      messageTwiml(
        "Thanks for your message. A member of our team will follow up with you shortly.",
      ),
    );
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
    "\nThis conversation is happening over text message (SMS), so keep replies concise and friendly. Ask one question at a time." +
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

  // Attempt to turn a confirmed text conversation into a real Job + Customer.
  let bookedCustomerId: string | null = null;
  let booked = false;
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
        const customerPhone = extraction.phone || from || null;
        let customerId = conversation.customerId ?? null;
        if (!customerId) {
          const existingCustomer = customerPhone
            ? await prisma.customer.findFirst({
                where: { businessId, phone: customerPhone },
              })
            : null;
          const customer =
            existingCustomer ??
            (await prisma.customer.create({
              data: {
                businessId,
                name: extraction.customerName || null,
                phone: customerPhone,
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
          "Booked via AI text message.",
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
            title: extraction.problemSummary || "Text booking request",
            problem: extraction.problemSummary || null,
            address: extraction.address || null,
            urgency: extraction.urgency,
            status: "BOOKED",
            scheduledAt,
            notes: noteParts.join(" "),
          },
        });
        booked = true;
        status = "BOOKED";
        await createNotification({
          businessId,
          type:
            extraction.urgency === "EMERGENCY" ? "URGENT_LEAD" : "NEW_BOOKING",
          title:
            (extraction.urgency === "EMERGENCY"
              ? "Urgent booking: "
              : "New booking: ") +
            (extraction.problemSummary || "Text request"),
          body:
            (extraction.customerName || "A customer") +
            " booked via the AI text line" +
            (extraction.preferredTime
              ? " for " + extraction.preferredTime
              : "") +
            ".",
          metadata: {
            jobId: job.id,
            conversationId: conversation.id,
            source: "SMS",
          },
        });
        await prisma.message.create({
          data: {
            businessId,
            conversationId: conversation.id,
            sender: "SYSTEM",
            content: "Booking created from SMS (Job " + job.id + ").",
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

  return xml(messageTwiml(reply));
}
