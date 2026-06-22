import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";
import { isTwilioConfigured, sendSms } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const runSchema = z.object({
  sendSms: z.boolean().optional(),
});

function money(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

// Builds a 7-day business summary (leads, completed jobs, revenue, missed-call
// recoveries, reviews requested, upcoming appointments). Returns the numbers and
// a human-readable line; optionally texts it to the business phone.
export async function POST(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const role = ctx.user.memberships[0]?.role;
  if (!can(role, "viewDashboard", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to view the digest" },
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
  const wantSms = parsed.data.sendSms ?? false;

  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const until7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    newLeads,
    completed,
    revenueAgg,
    missedRecovered,
    reviewsRequested,
    upcoming,
    business,
  ] = await Promise.all([
    prisma.job.count({ where: { businessId, createdAt: { gte: since } } }),
    prisma.job.count({
      where: {
        businessId,
        status: { in: ["COMPLETED", "PAID"] },
        updatedAt: { gte: since },
      },
    }),
    prisma.job.aggregate({
      _sum: { amountCharged: true },
      where: {
        businessId,
        status: { in: ["COMPLETED", "PAID"] },
        updatedAt: { gte: since },
      },
    }),
    prisma.notification.count({
      where: {
        businessId,
        type: "MISSED_CALL_RECOVERED",
        createdAt: { gte: since },
      },
    }),
    prisma.job.count({
      where: { businessId, reviewRequestedAt: { gte: since } },
    }),
    prisma.appointment.count({
      where: {
        businessId,
        startAt: { gte: now, lte: until7 },
        status: { in: ["SCHEDULED", "CONFIRMED", "RESCHEDULED"] },
      },
    }),
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, phone: true },
    }),
  ]);

  const revenue = revenueAgg._sum.amountCharged
    ? Number(revenueAgg._sum.amountCharged)
    : 0;
  const bizName = business?.name ?? "Your business";

  const summary = {
    newLeads,
    jobsCompleted: completed,
    revenue,
    missedCallsRecovered: missedRecovered,
    reviewsRequested,
    upcomingAppointments: upcoming,
  };

  const text =
    bizName +
    " - last 7 days: " +
    newLeads +
    " new leads, " +
    completed +
    " jobs completed (" +
    money(revenue) +
    "), " +
    missedRecovered +
    " missed calls recovered, " +
    reviewsRequested +
    " reviews requested. " +
    upcoming +
    " appointments in the next 7 days.";

  let sent = false;
  if (wantSms && business?.phone && isTwilioConfigured()) {
    sent = await sendSms(business.phone, text);
  }

  return NextResponse.json({ ok: true, summary, text, sent });
}
