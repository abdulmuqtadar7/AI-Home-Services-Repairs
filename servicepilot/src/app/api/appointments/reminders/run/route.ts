import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";
import { isTwilioConfiguredForBusiness, sendSms } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const runSchema = z.object({
  withinHours: z.coerce.number().int().min(1).max(720).optional(),
});

function formatWhen(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

// Sends pre-visit SMS reminders for upcoming appointments that have not been
// reminded yet, then stamps reminderSentAt so customers are never double-texted.
// Idempotent: safe to call repeatedly (e.g. from a scheduler).
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const role = ctx.user.memberships[0]?.role;
  if (!can(role, "editJobs", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to send reminders" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = runSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const withinHours = parsed.data.withinHours ?? 24;

  const now = new Date();
  const until = new Date(now.getTime() + withinHours * 60 * 60 * 1000);

  // Upcoming, still-active appointments that have not been reminded yet.
  const due = await prisma.appointment.findMany({
    where: {
      businessId,
      reminderSentAt: null,
      startAt: { gte: now, lte: until },
      status: { in: ["SCHEDULED", "CONFIRMED", "RESCHEDULED"] },
    },
    orderBy: { startAt: "asc" },
    include: {
      customer: { select: { name: true, phone: true } },
    },
  });

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  const bizName = business?.name ?? "our team";
  const twilioReady = await isTwilioConfiguredForBusiness(businessId);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const results: Array<{
    id: string;
    status: "sent" | "skipped" | "failed";
    to?: string | null;
    reason?: string;
  }> = [];

  for (const appt of due) {
    const phone = appt.customer?.phone ?? null;
    if (!phone) {
      skipped++;
      results.push({ id: appt.id, status: "skipped", reason: "no_phone" });
      continue;
    }
    if (!twilioReady) {
      skipped++;
      results.push({
        id: appt.id,
        status: "skipped",
        reason: "twilio_not_configured",
      });
      continue;
    }

    const name = appt.customer?.name ? " " + appt.customer.name : "";
    const message =
      "Hi" +
      name +
      ", this is a reminder from " +
      bizName +
      " about your appointment on " +
      formatWhen(appt.startAt) +
      ". Reply here if you need to reschedule.";

    const ok = await sendSms(phone, message, { businessId });
    if (ok) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
      results.push({ id: appt.id, status: "sent", to: phone });
    } else {
      failed++;
      results.push({ id: appt.id, status: "failed", to: phone });
    }
  }

  await prisma.auditLog.create({
    data: {
      businessId,
      userId: ctx.user.id,
      action: "APPOINTMENT_REMINDERS_RUN",
      entityType: "Appointment",
      metadata: {
        withinHours,
        considered: due.length,
        sent,
        skipped,
        failed,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    withinHours,
    considered: due.length,
    sent,
    skipped,
    failed,
    results,
  });
}
