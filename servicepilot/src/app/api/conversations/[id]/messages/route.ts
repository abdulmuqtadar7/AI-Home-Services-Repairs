import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";

const SENDERS = ["CUSTOMER", "AI", "HUMAN_AGENT", "SYSTEM"] as const;

const schema = z.object({
  content: z.string().min(1).max(5000),
  sender: z.enum(SENDERS).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;
  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Message text is required" },
      { status: 400 },
    );
  }

  const sender = parsed.data.sender ?? "HUMAN_AGENT";

  const message = await prisma.message.create({
    data: {
      businessId,
      conversationId: id,
      sender,
      content: parsed.data.content,
    },
  });

  const convoData: { lastMessageAt: Date; aiActive?: boolean } = {
    lastMessageAt: new Date(),
  };
  if (sender === "HUMAN_AGENT") convoData.aiActive = false;
  await prisma.conversation.update({ where: { id }, data: convoData });

  return NextResponse.json({
    ok: true,
    message: {
      id: message.id,
      sender: message.sender,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    },
  });
}
