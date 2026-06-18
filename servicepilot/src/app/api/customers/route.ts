import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";

const optEmail = z
  .union([z.string().trim().email(), z.literal("")])
  .optional()
  .nullable();

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  email: optEmail,
  address: z.string().trim().max(300).optional().nullable(),
  zipCode: z.string().trim().max(20).optional().nullable(),
  type: z.enum(["RESIDENTIAL", "COMMERCIAL"]).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;

  const q = new URL(req.url).searchParams.get("q")?.trim();
  const customers = await prisma.customer.findMany({
    where: {
      businessId: ctx.businessId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ customers });
}

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const customer = await prisma.customer.create({
    data: {
      businessId: ctx.businessId,
      name: d.name,
      phone: d.phone || null,
      email: d.email || null,
      address: d.address || null,
      zipCode: d.zipCode || null,
      type: d.type ?? "RESIDENTIAL",
      notes: d.notes || null,
    },
  });
  return NextResponse.json({ ok: true, customer });
}
