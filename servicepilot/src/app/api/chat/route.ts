import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  buildSystemPrompt,
  detectEmergency,
  generateAiReply,
  type ChatTurn,
} from "@/lib/ai";

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

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }
  const aiSetting = await prisma.aiSetting.findUnique({
    where: { businessId },
  });

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
    buildSystemPrompt(business, aiSetting) +
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

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), status },
  });

  return NextResponse.json({
    sessionId: session,
    conversationId: conversation.id,
    reply,
    handoff: false,
    emergency: emergency.isEmergency,
    status,
  });
}
