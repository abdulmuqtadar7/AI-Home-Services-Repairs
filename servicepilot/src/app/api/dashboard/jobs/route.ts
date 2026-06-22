import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_JOB_STATUSES = [
  "NEW_LEAD",
  "QUALIFIED",
  "ESTIMATE_REQUESTED",
  "BOOKED",
  "DISPATCHED",
  "IN_PROGRESS",
];

const DONE_STATUSES = ["COMPLETED", "PAID"];

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
];

const URGENCIES = ["EMERGENCY", "HIGH", "NORMAL", "LOW"];

// Returns a compact JSON list of jobs matching the dashboard card filters.
// Query params mirror the Jobs page: status, urgency, days, dateField.
export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const role = ctx.user.memberships[0]?.role;
  if (!can(role, "viewDashboard", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusParam = (url.searchParams.get("status") ?? "").toUpperCase();
  const urgencyParam = (url.searchParams.get("urgency") ?? "").toUpperCase();
  const days = parseInt(url.searchParams.get("days") ?? "", 10);
  const dateField =
    (url.searchParams.get("dateField") ?? "created").toLowerCase() === "updated"
      ? "updatedAt"
      : "createdAt";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { businessId };
  if (statusParam === "OPEN") where.status = { in: OPEN_JOB_STATUSES };
  else if (statusParam === "DONE") where.status = { in: DONE_STATUSES };
  else if (JOB_STATUSES.includes(statusParam)) where.status = statusParam;

  if (URGENCIES.includes(urgencyParam)) where.urgency = urgencyParam;

  if (Number.isFinite(days) && days > 0 && days <= 3650) {
    where[dateField] = {
      gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    };
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      customer: { select: { name: true } },
      technician: { select: { name: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    count: jobs.length,
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      urgency: j.urgency,
      customer: j.customer?.name ?? null,
      technician: j.technician?.name ?? null,
      amountCharged: j.amountCharged ? Number(j.amountCharged) : null,
    })),
  });
}
