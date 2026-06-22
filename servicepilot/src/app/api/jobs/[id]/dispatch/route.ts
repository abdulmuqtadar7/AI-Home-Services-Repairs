import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";
import { isTwilioConfigured, sendSms } from "@/lib/twilio";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dispatchSchema = z.object({
  technicianId: z.string().trim().min(1).optional(),
});

// Assigns a technician to the job (if one is provided, otherwise reuses the one
// already on the job), moves the job to DISPATCHED, texts the technician their
// assignment, and records a notification + audit entry.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const role = ctx.user.memberships[0]?.role;
  if (!can(role, "editJobs", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to dispatch jobs" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = dispatchSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const job = await prisma.job.findFirst({
    where: { id, businessId },
    include: {
      customer: { select: { name: true } },
    },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Use the technician from the request, falling back to the one already on the
  // job. Dispatching requires a technician.
  const technicianId = parsed.data.technicianId ?? job.technicianId;
  if (!technicianId) {
    return NextResponse.json(
      { error: "Assign a technician before dispatching" },
      { status: 400 },
    );
  }

  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, businessId },
    select: { id: true, name: true, phone: true, userId: true },
  });
  if (!technician) {
    return NextResponse.json(
      { error: "Technician not found" },
      { status: 400 },
    );
  }

  const updated = await prisma.job.update({
    where: { id },
    data: { technicianId, status: "DISPATCHED" },
  });

  // Text the technician their assignment when we have a number + Twilio.
  const forCustomer = job.customer?.name ? " for " + job.customer.name : "";
  const atAddress = job.address ? " at " + job.address : "";
  const message =
    "New job assigned: " + job.title + forCustomer + atAddress + ".";
  let smsSent = false;
  if (technician.phone && isTwilioConfigured()) {
    smsSent = await sendSms(technician.phone, message);
  }

  await createNotification({
    businessId,
    type: "JOB_DISPATCHED",
    title: "Job dispatched: " + job.title,
    body: technician.name + " has been dispatched" + forCustomer + ".",
    recipientId: technician.userId ?? undefined,
    metadata: {
      jobId: id,
      technicianId: technician.id,
      smsSent,
    },
  });

  await prisma.auditLog.create({
    data: {
      businessId,
      userId: ctx.user.id,
      action: "JOB_DISPATCHED",
      entityType: "Job",
      entityId: id,
      metadata: {
        technicianId: technician.id,
        smsSent,
        to: technician.phone,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    job: updated,
    technician: { id: technician.id, name: technician.name },
    sent: smsSent,
    to: technician.phone,
  });
}
