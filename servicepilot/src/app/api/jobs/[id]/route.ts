import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";

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

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, businessId: ctx.businessId },
    include: {
      customer: { select: { id: true, name: true } },
      technician: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
    },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;
  const { id } = await params;

  const role = ctx.user.memberships[0]?.role;
  const isSuperAdmin = ctx.user.isSuperAdmin;
  const canEdit = can(role, "editJobs", { isSuperAdmin });

  const existing = await prisma.job.findFirst({
    where: { id, businessId },
    select: { id: true, technicianId: true },
  });
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

  // Non-editors (technicians) may only advance the status of a job assigned to
  // them. No reassigning, no editing any other field.
  if (!canEdit) {
    const myTech = await prisma.technician.findFirst({
      where: { businessId, userId: ctx.user.id },
      select: { id: true },
    });
    if (!myTech || existing.technicianId !== myTech.id) {
      return NextResponse.json(
        { error: "You can only update jobs assigned to you" },
        { status: 403 },
      );
    }
    const provided = Object.keys(d).filter(
      (k) => (d as Record<string, unknown>)[k] !== undefined,
    );
    if (
      d.status === undefined ||
      provided.length === 0 ||
      !provided.every((k) => k === "status")
    ) {
      return NextResponse.json(
        { error: "You can only change the job status" },
        { status: 403 },
      );
    }
    const job = await prisma.job.update({
      where: { id },
      data: { status: d.status },
    });
    return NextResponse.json({ ok: true, job });
  }

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

  const data: Record<string, unknown> = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.customerId !== undefined) data.customerId = d.customerId || null;
  if (d.serviceId !== undefined) data.serviceId = d.serviceId || null;
  if (d.technicianId !== undefined) data.technicianId = d.technicianId || null;
  if (d.problem !== undefined) data.problem = d.problem || null;
  if (d.address !== undefined) data.address = d.address || null;
  if (d.zipCode !== undefined) data.zipCode = d.zipCode || null;
  if (d.urgency !== undefined) data.urgency = d.urgency;
  if (d.status !== undefined) data.status = d.status;
  if (d.customerType !== undefined) data.customerType = d.customerType;
  if (d.notes !== undefined) data.notes = d.notes || null;

  if (d.scheduledAt !== undefined) {
    if (!d.scheduledAt) {
      data.scheduledAt = null;
    } else {
      const dt = new Date(d.scheduledAt);
      if (Number.isNaN(dt.getTime())) {
        return NextResponse.json(
          { error: "Invalid scheduled date" },
          { status: 400 },
        );
      }
      data.scheduledAt = dt;
    }
  }

  if (d.amountCharged !== undefined) {
    if (d.amountCharged === null || d.amountCharged === "") {
      data.amountCharged = null;
    } else {
      const n = Number(d.amountCharged);
      if (Number.isNaN(n)) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      data.amountCharged = n;
    }
  }

  const job = await prisma.job.update({ where: { id }, data });
  return NextResponse.json({ ok: true, job });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;

  // Only owners/dispatchers (and super admins) may delete jobs.
  const role = ctx.user.memberships[0]?.role;
  if (!can(role, "editJobs", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to delete jobs" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const existing = await prisma.job.findFirst({
    where: { id, businessId: ctx.businessId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.job.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
