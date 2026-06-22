import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";
import {
  APPOINTMENT_STATUSES,
  apptInclude,
  findTechnicianConflict,
  isAppointmentStatus,
} from "@/lib/appointments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function roleOf(ctx: { user: { memberships: { role: string }[] } }) {
  return ctx.user.memberships[0]?.role;
}

const createSchema = z
  .object({
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    technicianId: z.string().trim().min(1).optional().nullable(),
    jobId: z.string().trim().min(1).optional().nullable(),
    customerId: z.string().trim().min(1).optional().nullable(),
    status: z.enum(APPOINTMENT_STATUSES).optional(),
  })
  .refine((d) => d.endAt.getTime() > d.startAt.getTime(), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const technicianId = searchParams.get("technicianId");
  const statusParam = searchParams.get("status");

  const where: Record<string, unknown> = { businessId };

  // Date-range filter on the appointment start time.
  const startFilter: Record<string, Date> = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) startFilter.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) startFilter.lte = d;
  }
  if (Object.keys(startFilter).length > 0) where.startAt = startFilter;

  if (statusParam && isAppointmentStatus(statusParam)) {
    where.status = statusParam;
  }

  // Dispatchers and owners can manage the whole calendar. Technicians only see
  // their own appointments (scoped to their linked technician record).
  const canManage = can(roleOf(ctx), "editJobs", {
    isSuperAdmin: ctx.user.isSuperAdmin,
  });
  if (canManage) {
    if (technicianId) where.technicianId = technicianId;
  } else {
    const myTech = await prisma.technician.findFirst({
      where: { businessId, userId: ctx.user.id },
      select: { id: true },
    });
    if (!myTech) return NextResponse.json({ appointments: [] });
    where.technicianId = myTech.id;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: apptInclude,
  });
  return NextResponse.json({ appointments });
}

export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  if (!can(roleOf(ctx), "editJobs", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to schedule appointments" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Validate that any linked records belong to this business.
  let resolvedCustomerId = d.customerId ?? null;
  if (d.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: d.jobId, businessId },
      select: { id: true, customerId: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (!resolvedCustomerId) resolvedCustomerId = job.customerId ?? null;
  }
  if (resolvedCustomerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: resolvedCustomerId, businessId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }
  }
  if (d.technicianId) {
    const tech = await prisma.technician.findFirst({
      where: { id: d.technicianId, businessId },
      select: { id: true },
    });
    if (!tech) {
      return NextResponse.json(
        { error: "Technician not found" },
        { status: 404 },
      );
    }
    const conflict = await findTechnicianConflict({
      businessId,
      technicianId: d.technicianId,
      startAt: d.startAt,
      endAt: d.endAt,
    });
    if (conflict) {
      return NextResponse.json(
        {
          error: "That technician is already booked during this time",
          conflict,
        },
        { status: 409 },
      );
    }
  }

  const appointment = await prisma.appointment.create({
    data: {
      businessId,
      startAt: d.startAt,
      endAt: d.endAt,
      technicianId: d.technicianId ?? null,
      jobId: d.jobId ?? null,
      customerId: resolvedCustomerId,
      status: d.status ?? "SCHEDULED",
    },
    include: apptInclude,
  });
  return NextResponse.json({ ok: true, appointment });
}
