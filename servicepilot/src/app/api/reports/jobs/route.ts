import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/lib/api-context";
import { can } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

// Exports jobs (with revenue) for a date range as a downloadable CSV.
// Query params: from=YYYY-MM-DD, to=YYYY-MM-DD (both optional; defaults to
// the last 30 days). Filtered by job creation date.
export async function GET(req: Request) {
  const ctx = await getApiContext();
  if (!ctx.ok) return ctx.res;
  const { businessId } = ctx;

  const role = ctx.user.memberships[0]?.role;
  if (!can(role, "viewDashboard", { isSuperAdmin: ctx.user.isSuperAdmin })) {
    return NextResponse.json(
      { error: "You do not have permission to export reports" },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = parseDate(url.searchParams.get("from"), defaultFrom);
  const toRaw = parseDate(url.searchParams.get("to"), now);
  const to = new Date(toRaw.getTime());
  to.setHours(23, 59, 59, 999);

  const jobs = await prisma.job.findMany({
    where: { businessId, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, phone: true } },
      service: { select: { name: true } },
      technician: { select: { name: true } },
    },
  });

  const header = [
    "Job ID",
    "Created",
    "Title",
    "Status",
    "Urgency",
    "Customer",
    "Phone",
    "Technician",
    "Service",
    "Scheduled",
    "Amount",
  ];

  const lines = [header.map(csvCell).join(",")];
  let total = 0;
  for (const j of jobs) {
    const amount = j.amountCharged ? Number(j.amountCharged) : 0;
    total += amount;
    lines.push(
      [
        j.id,
        j.createdAt.toISOString(),
        j.title,
        j.status,
        j.urgency,
        j.customer?.name ?? "",
        j.customer?.phone ?? "",
        j.technician?.name ?? "",
        j.service?.name ?? "",
        j.scheduledAt ? j.scheduledAt.toISOString() : "",
        amount ? amount.toFixed(2) : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push("");
  lines.push(
    ["TOTAL", "", "", "", "", "", "", "", "", "", total.toFixed(2)]
      .map(csvCell)
      .join(","),
  );

  const csv = lines.join("\n");
  const fname =
    "jobs-" +
    from.toISOString().slice(0, 10) +
    "-to-" +
    toRaw.toISOString().slice(0, 10) +
    ".csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + fname + '"',
    },
  });
}
