import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";

const JOB_STATUSES = [
  "NEW_LEAD",
  "QUALIFIED",
  "ESTIMATE_REQUESTED",
  "BOOKED",
  "DISPATCHED",
  "IN_PROGRESS",
  "COMPLETED",
  "PAID",
  "REVIEW_REQUESTED",
  "LOST_CANCELLED",
] as const;
const URGENCIES = ["LOW", "NORMAL", "HIGH", "EMERGENCY"] as const;
const CUSTOMER_TYPES = ["RESIDENTIAL", "COMMERCIAL"] as const;

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  customerId: z.string().trim().optional().nullable(),
  serviceId: z.string().trim().optional().nullable(),
  technicianId: z.string().trim().optional().nullable(),
  problem: z.string().trim().max(2000).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  zipCode: z.string().trim().max(20).optional().nullable(),
  urgency: z.enum(URGENCIES).optional(),
  status: z.enum(JOB_STATUSES).optional(),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  scheduledAt: z.string().trim().optional().nullable(),
  amountCharged: z.union([z.number(), z.string()]).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

async function belongsToBusiness(
  model: "customer" | "technician" | "service",
  id: string,
  businessId: string,
) {
  if (model === "customer") {
    return prisma.customer.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
  }
  if (model === "technician") {
    return prisma.technician.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
  }
  return prisma.service.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
}

export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;

  const params = new URL(req.url).searchParams;
  const status = params.get("status")?.trim();
  const q = params.get("q")?.trim();

  const jobs = await prisma.job.findMany({
    where: {
      businessId: ctx.businessId,
      ...(status ? { status: status as (typeof JOB_STATUSES)[number] } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { problem: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: { select: { id: true, name: true } },
      technician: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  if (
    d.customerId &&
    !(await belongsToBusiness("customer", d.customerId, businessId))
  ) {
    return NextResponse.json({ error: "Customer not found" }, { status: 400 });
  }
  if (
    d.technicianId &&
    !(await belongsToBusiness("technician", d.technicianId, businessId))
  ) {
    return NextResponse.json(
      { error: "Technician not found" },
      { status: 400 },
    );
  }
  if (
    d.serviceId &&
    !(await belongsToBusiness("service", d.serviceId, businessId))
  ) {
    return NextResponse.json({ error: "Service not found" }, { status: 400 });
  }

  const amount =
    d.amountCharged === undefined ||
    d.amountCharged === null ||
    d.amountCharged === ""
      ? null
      : Number(d.amountCharged);
  if (amount !== null && Number.isNaN(amount)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  let scheduledAt: Date | null = null;
  if (d.scheduledAt) {
    const dt = new Date(d.scheduledAt);
    if (Number.isNaN(dt.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduled date" },
        { status: 400 },
      );
    }
    scheduledAt = dt;
  }

  const job = await prisma.job.create({
    data: {
      businessId,
      title: d.title,
      customerId: d.customerId || null,
      serviceId: d.serviceId || null,
      technicianId: d.technicianId || null,
      problem: d.problem || null,
      address: d.address || null,
      zipCode: d.zipCode || null,
      urgency: d.urgency ?? "NORMAL",
      status: d.status ?? "NEW_LEAD",
      customerType: d.customerType ?? "RESIDENTIAL",
      scheduledAt,
      amountCharged: amount,
      notes: d.notes || null,
    },
  });
  return NextResponse.json({ ok: true, job });
}
