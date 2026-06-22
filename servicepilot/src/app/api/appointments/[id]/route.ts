import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";
import {
  APPOINTMENT_STATUSES,
  apptInclude,
  findTechnicianConflict,
  isBlockingStatus,
} from "@/lib/appointments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function roleOf(ctx: { user: { memberships: { role: string }[] } }) {
  return ctx.user.memberships[0]?.role;
}

const updateSchema = z
  .object({
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    technicianId: z.string().trim().min(1).optional().nullable(),
    jobId: z.string().trim().min(1).optional().nullable(),
    customerId: z.string().trim().min(1).optional().nullable(),
    status: z.enum(APPOINTMENT_STATUSES).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "No fields to update",
  });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId },
    include: apptInclude,
  });
  if (!appointment) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 },
    );
  }

  // Technicians may only view their own appointments.
  const canManage = can(roleOf(ctx), "editJobs", {
    isSuperAdmin: ctx.user.isSuperAdmin,
  });
  if (!canManage) {
    const myTech = await prisma.technician.findFirst({
      where: { businessId, userId: ctx.user.id },
      select: { id: true },
    });
    if (!myTech || appointment.technicianId !== myTech.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  return NextResponse.json({ appointment });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  if (!can(roleOf(ctx), "editJobs", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to edit appointments" },
      { status: 403 },
    );
  }

  const existing = await prisma.appointment.findFirst({
    where: { id, businessId },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 },
    );
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

  const nextStart = d.startAt ?? existing.startAt;
  const nextEnd = d.endAt ?? existing.endAt;
  if (nextEnd.getTime() <= nextStart.getTime()) {
    return NextResponse.json(
      { error: "endAt must be after startAt" },
      { status: 400 },
    );
  }

  // Validate linked records belong to this business.
  if (d.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: d.jobId, businessId },
      select: { id: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
  }
  if (d.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: d.customerId, businessId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }
  }

  const nextTechnicianId =
    d.technicianId !== undefined ? d.technicianId : existing.technicianId;
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
  }

  // Re-check for double-booking whenever the slot or technician moves and the
  // appointment is still in a blocking state.
  const nextStatus = d.status ?? existing.status;
  if (nextTechnicianId && isBlockingStatus(nextStatus)) {
    const conflict = await findTechnicianConflict({
      businessId,
      technicianId: nextTechnicianId,
      startAt: nextStart,
      endAt: nextEnd,
      excludeId: id,
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

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...(d.startAt !== undefined ? { startAt: d.startAt } : {}),
      ...(d.endAt !== undefined ? { endAt: d.endAt } : {}),
      ...(d.technicianId !== undefined ? { technicianId: d.technicianId } : {}),
      ...(d.jobId !== undefined ? { jobId: d.jobId } : {}),
      ...(d.customerId !== undefined ? { customerId: d.customerId } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
    },
    include: apptInclude,
  });
  return NextResponse.json({ ok: true, appointment });
}

// Cancelling is a soft action: we set status to CANCELLED so the slot frees up
// but the history is preserved. Pass ?hard=1 to permanently delete.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  if (!can(roleOf(ctx), "editJobs", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to cancel appointments" },
      { status: 403 },
    );
  }

  const existing = await prisma.appointment.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("hard") === "1") {
    await prisma.appointment.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: apptInclude,
  });
  return NextResponse.json({ ok: true, appointment });
}
