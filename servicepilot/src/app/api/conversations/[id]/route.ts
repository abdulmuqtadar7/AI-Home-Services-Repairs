import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";

const STATUSES = [
  "NEW_LEAD",
  "AI_HANDLING",
  "HUMAN_NEEDED",
  "BOOKED",
  "COMPLETED",
  "LOST",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;
  const { id } = await params;

  const conversation = await prisma.conversation.findFirst({
    where: { id, businessId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    conversation: {
      id: conversation.id,
      channel: conversation.channel,
      status: conversation.status,
      aiActive: conversation.aiActive,
      customer: conversation.customer,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  });
}

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  aiActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;
  const { id } = await params;

  const existing = await prisma.conversation.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const conversation = await prisma.conversation.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ ok: true, conversation });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;
  const { id } = await params;

  const existing = await prisma.conversation.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.conversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
