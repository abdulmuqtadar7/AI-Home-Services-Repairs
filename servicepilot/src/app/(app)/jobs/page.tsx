import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, normalizeRole } from "@/lib/rbac";
import { JobBoard, type BoardJob } from "@/components/JobBoard";

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

function labelize(s: string) {
  return s.replace(/_/g, " ").toLowerCase();
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    urgency?: string;
    days?: string;
    dateField?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const role = user.memberships[0]?.role;
  const isSuperAdmin = user.isSuperAdmin;
  const isTechnician = !isSuperAdmin && normalizeRole(role) === "TECHNICIAN";
  const canCreate = can(role, "createJobs", { isSuperAdmin });

  const sp = await searchParams;
  const statusParam = (sp.status ?? "").toUpperCase();
  const urgencyParam = (sp.urgency ?? "").toUpperCase();
  const days = parseInt(sp.days ?? "", 10);
  const dateField =
    (sp.dateField ?? "created").toLowerCase() === "updated"
      ? "updatedAt"
      : "createdAt";

  // Technicians only ever see jobs assigned to them.
  let technicianId: string | null = null;
  if (isTechnician) {
    const tech = await prisma.technician.findFirst({
      where: { businessId, userId: user.id },
      select: { id: true },
    });
    technicianId = tech?.id ?? null;
  }

  // Build optional filters from the query string.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    businessId,
    ...(isTechnician ? { technicianId: technicianId ?? "__none__" } : {}),
  };

  const labelParts: string[] = [];
  if (statusParam === "OPEN") {
    where.status = { in: OPEN_JOB_STATUSES };
    labelParts.push("Open jobs");
  } else if (statusParam === "DONE") {
    where.status = { in: DONE_STATUSES };
    labelParts.push("Completed / paid");
  } else if (JOB_STATUSES.includes(statusParam)) {
    where.status = statusParam;
    labelParts.push(labelize(statusParam));
  }

  if (URGENCIES.includes(urgencyParam)) {
    where.urgency = urgencyParam;
    labelParts.push(labelize(urgencyParam) + " urgency");
  }

  if (Number.isFinite(days) && days > 0 && days <= 3650) {
    where[dateField] = {
      gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    };
    labelParts.push("last " + days + " days");
  }

  const filterLabel = labelParts.length ? labelParts.join(" - ") : null;

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: { select: { name: true } },
      technician: { select: { name: true } },
    },
  });

  const boardJobs: BoardJob[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    urgency: j.urgency,
    amountCharged: j.amountCharged ? Number(j.amountCharged) : null,
    customerName: j.customer?.name ?? null,
    technicianName: j.technician?.name ?? null,
    scheduledAt: j.scheduledAt ? j.scheduledAt.toISOString() : null,
  }));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isTechnician ? "My Jobs" : "Jobs"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isTechnician
              ? `${jobs.length} job${jobs.length === 1 ? "" : "s"} assigned to you`
              : `${jobs.length} job${jobs.length === 1 ? "" : "s"}${
                  filterLabel ? "" : " in your pipeline"
                }`}
          </p>
          {filterLabel && (
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {filterLabel}
              </span>
              <Link
                href="/jobs"
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Clear filter
              </Link>
            </div>
          )}
        </div>
        {canCreate && (
          <Link
            href="/jobs/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            New job
          </Link>
        )}
      </div>
      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center">
          <p className="text-sm text-slate-500">
            {filterLabel
              ? "No jobs match this filter."
              : isTechnician
                ? "No jobs assigned to you yet."
                : "No jobs yet. Create your first one to start the pipeline."}
          </p>
        </div>
      ) : (
        <JobBoard jobs={boardJobs} />
      )}
    </div>
  );
}
