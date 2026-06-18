import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";

const CHANNELS = ["WEB_CHAT", "SMS", "WHATSAPP", "VOICE", "EMAIL"] as const;
const STATUSES = [
  "NEW_LEAD",
  "AI_HANDLING",
  "HUMAN_NEEDED",
  "BOOKED",
  "COMPLETED",
  "LOST",
] as const;

type Status = (typeof STATUSES)[number];

export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const q = searchParams.get("q")?.trim();

  const where: { businessId: string; status?: Status } = { businessId };
  if (statusParam && (STATUSES as readonly string[]).includes(statusParam)) {
    where.status = statusParam as Status;
  }

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  });

  let list = conversations.map((c) => ({
    id: c.id,
    channel: c.channel,
    status: c.status,
    aiActive: c.aiActive,
    lastMessageAt: c.lastMessageAt.toISOString(),
    customer: c.customer,
    messageCount: c._count.messages,
    preview: c.messages[0]?.content ?? "",
    previewSender: c.messages[0]?.sender ?? null,
  }));

  if (q) {
    const needle = q.toLowerCase();
    list = list.filter(
      (c) =>
        (c.customer?.name ?? "").toLowerCase().includes(needle) ||
        c.preview.toLowerCase().includes(needle),
    );
  }

  return NextResponse.json({ ok: true, conversations: list });
}

const createSchema = z.object({
  customerId: z.string().optional().nullable(),
  channel: z.enum(CHANNELS).optional(),
  status: z.enum(STATUSES).optional(),
  message: z.string().optional(),
});

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;

  if (data.customerId) {
    const cust = await prisma.customer.findFirst({
      where: { id: data.customerId, businessId },
      select: { id: true },
    });
    if (!cust) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 400 },
      );
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      businessId,
      customerId: data.customerId ?? null,
      channel: data.channel ?? "WEB_CHAT",
      status: data.status ?? "NEW_LEAD",
      messages: data.message
        ? { create: { businessId, sender: "CUSTOMER", content: data.message } }
        : undefined,
    },
  });

  return NextResponse.json({ ok: true, conversation });
}
