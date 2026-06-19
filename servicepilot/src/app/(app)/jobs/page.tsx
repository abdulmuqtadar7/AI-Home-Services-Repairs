import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, normalizeRole } from "@/lib/rbac";
import { JobBoard, type BoardJob } from "@/components/JobBoard";

export default async function JobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const role = user.memberships[0]?.role;
  const isSuperAdmin = user.isSuperAdmin;
  const isTechnician = !isSuperAdmin && normalizeRole(role) === "TECHNICIAN";
  const canCreate = can(role, "createJobs", { isSuperAdmin });

  // Technicians only ever see jobs assigned to them.
  let technicianId: string | null = null;
  if (isTechnician) {
    const tech = await prisma.technician.findFirst({
      where: { businessId, userId: user.id },
      select: { id: true },
    });
    technicianId = tech?.id ?? null;
  }

  const jobs = await prisma.job.findMany({
    where: {
      businessId,
      // When a technician has no linked record yet, "__none__" matches nothing.
      ...(isTechnician ? { technicianId: technicianId ?? "__none__" } : {}),
    },
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
              : `${jobs.length} job${jobs.length === 1 ? "" : "s"} in your pipeline`}
          </p>
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
            {isTechnician
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
