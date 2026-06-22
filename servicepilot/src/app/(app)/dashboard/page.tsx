import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DigestButton } from "@/components/DigestButton";
import { StatCards, type StatCardDef } from "@/components/StatCards";
import { PipelineTiles } from "@/components/PipelineTiles";
import { scoreLead } from "@/lib/leadScore";

export const dynamic = "force-dynamic";

const OPEN_JOB_STATUSES = [
  "NEW_LEAD",
  "QUALIFIED",
  "ESTIMATE_REQUESTED",
  "BOOKED",
  "DISPATCHED",
  "IN_PROGRESS",
] as const;

const OPEN_LEAD_STATUSES = [
  "NEW_LEAD",
  "QUALIFIED",
  "ESTIMATE_REQUESTED",
  "BOOKED",
] as const;

const PIPELINE: { key: string; label: string }[] = [
  { key: "NEW_LEAD", label: "New leads" },
  { key: "QUALIFIED", label: "Qualified" },
  { key: "ESTIMATE_REQUESTED", label: "Estimate" },
  { key: "BOOKED", label: "Booked" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "PAID", label: "Paid" },
  { key: "REVIEW_REQUESTED", label: "Review" },
  { key: "LOST_CANCELLED", label: "Lost" },
];

function money(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function fmtAppt(d: Date) {
  const iso = d.toISOString();
  return iso.slice(0, 10) + " " + iso.slice(11, 16) + " UTC";
}

function tierBadge(tier: string) {
  if (tier === "hot") return "bg-red-50 text-red-700";
  if (tier === "warm") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;

  if (!businessId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-slate-500">
          Your account isn't linked to a business yet.
        </p>
      </div>
    );
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [
    customers,
    openJobs,
    emergencies,
    needsHuman,
    revenueAgg,
    statusGroups,
    newLeads30,
    completed30,
    missedRecovered30,
    reviewsRequested30,
    upcomingAppointments,
    recentJobs,
    openLeads,
  ] = await Promise.all([
    prisma.customer.count({ where: { businessId } }),
    prisma.job.count({
      where: { businessId, status: { in: [...OPEN_JOB_STATUSES] } },
    }),
    prisma.job.count({
      where: {
        businessId,
        urgency: "EMERGENCY",
        status: { in: [...OPEN_JOB_STATUSES] },
      },
    }),
    prisma.conversation.count({
      where: { businessId, status: "HUMAN_NEEDED" },
    }),
    prisma.job.aggregate({
      _sum: { amountCharged: true },
      where: { businessId, status: { in: ["COMPLETED", "PAID"] } },
    }),
    prisma.job.groupBy({
      by: ["status"],
      where: { businessId },
      _count: { _all: true },
    }),
    prisma.job.count({ where: { businessId, createdAt: { gte: since } } }),
    prisma.job.count({
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
    prisma.appointment.findMany({
      where: {
        businessId,
        startAt: { gte: now },
        status: { in: ["SCHEDULED", "CONFIRMED", "RESCHEDULED"] },
      },
      orderBy: { startAt: "asc" },
      take: 5,
      include: {
        customer: { select: { name: true } },
        technician: { select: { name: true } },
      },
    }),
    prisma.job.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { customer: true, technician: true },
    }),
    prisma.job.findMany({
      where: { businessId, status: { in: [...OPEN_LEAD_STATUSES] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        customer: { select: { name: true, phone: true, isReturning: true } },
      },
    }),
  ]);

  const revenue = revenueAgg._sum.amountCharged
    ? Number(revenueAgg._sum.amountCharged)
    : 0;
  const statusCounts = new Map<string, number>(
    statusGroups.map((g) => [g.status, g._count._all]),
  );

  const pipelineStages = PIPELINE.map((s) => ({
    key: s.key,
    label: s.label,
    count: statusCounts.get(s.key) ?? 0,
  }));

  const hotLeads = openLeads
    .map((job) => {
      const result = scoreLead(
        {
          status: job.status,
          urgency: job.urgency,
          createdAt: job.createdAt,
          customerPhone: job.customer?.phone ?? null,
          customerReturning: job.customer?.isReturning ?? false,
          amountCharged: job.amountCharged ? Number(job.amountCharged) : null,
        },
        now,
      );
      return {
        id: job.id,
        title: job.title,
        customer: job.customer?.name ?? null,
        score: result.score,
        tier: result.tier,
        reasons: result.reasons,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const primaryCards: StatCardDef[] = [
    { label: "Open jobs", value: openJobs, query: "status=open" },
    {
      label: "Emergencies",
      value: emergencies,
      accent: emergencies > 0 ? "text-red-600" : "text-slate-900",
      query: "status=open&urgency=EMERGENCY",
    },
    {
      label: "Needs human reply",
      value: needsHuman,
      accent: needsHuman > 0 ? "text-amber-600" : "text-slate-900",
      href: "/inbox",
    },
    {
      label: "Revenue (paid)",
      value: money(revenue),
      accent: "text-emerald-600",
      query: "status=done",
    },
  ];

  const last30Cards: StatCardDef[] = [
    { label: "New leads", value: newLeads30, query: "days=30" },
    {
      label: "Jobs completed",
      value: completed30,
      query: "status=done&days=30&dateField=updated",
    },
    {
      label: "Missed calls recovered",
      value: missedRecovered30,
      href: "/inbox",
    },
    { label: "Reviews requested", value: reviewsRequested30, href: "/reviews" },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, {user.name.split(" ")[0]}. You have {customers}{" "}
            customers on file.
          </p>
        </div>
        <DigestButton />
      </div>

      <StatCards cards={primaryCards} />

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Hot leads</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Ranked by urgency, freshness, and value - chase these first.
          </p>
        </div>
        {hotLeads.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No open leads right now.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {hotLeads.map((lead) => (
              <li
                key={lead.id}
                className="flex items-start justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/jobs/${lead.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-indigo-600"
                  >
                    {lead.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {lead.customer ?? "No customer"}
                    {" - "}
                    {lead.reasons.slice(0, 3).join(", ")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${tierBadge(lead.tier)}`}
                >
                  {lead.tier} {lead.score}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-8 mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        Last 30 days
      </p>
      <StatCards cards={last30Cards} />

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Pipeline</h2>
        <PipelineTiles stages={pipelineStages} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Upcoming appointments
            </h2>
          </div>
          {upcomingAppointments.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Nothing scheduled.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingAppointments.map((appt) => (
                <li key={appt.id} className="px-5 py-3 text-sm">
                  <p className="font-medium text-slate-900">
                    {fmtAppt(appt.startAt)}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    {appt.customer?.name ?? "No customer"}
                    {appt.technician?.name
                      ? " with " + appt.technician.name
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent jobs
            </h2>
          </div>
          {recentJobs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No jobs yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentJobs.map((job) => (
                <li key={job.id} className="px-5 py-3 text-sm">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-600"
                  >
                    {job.title}
                  </Link>
                  <p className="mt-0.5 text-slate-500">
                    {job.customer?.name ?? "No customer"}
                    {" - "}
                    {job.technician?.name ?? "Unassigned"}
                    {" - "}
                    {job.status.replace(/_/g, " ").toLowerCase()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
