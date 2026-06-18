import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";

const optEmail = z
  .union([z.string().trim().email(), z.literal("")])
  .optional()
  .nullable();

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: optEmail,
  address: z.string().trim().max(300).optional().nullable(),
  zipCode: z.string().trim().max(20).optional().nullable(),
  type: z.enum(["RESIDENTIAL", "COMMERCIAL"]).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

async function owned(businessId: string, id: string) {
  return prisma.customer.findFirst({ where: { id, businessId } });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, businessId: ctx.businessId },
    include: { jobs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ customer });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { id } = await params;
  const existing = await owned(ctx.businessId, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
      ...(d.email !== undefined ? { email: d.email || null } : {}),
      ...(d.address !== undefined ? { address: d.address || null } : {}),
      ...(d.zipCode !== undefined ? { zipCode: d.zipCode || null } : {}),
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
    },
  });
  return NextResponse.json({ ok: true, customer });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { id } = await params;
  const existing = await owned(ctx.businessId, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
