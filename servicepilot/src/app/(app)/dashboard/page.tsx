import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const OPEN_JOB_STATUSES = [
  "NEW_LEAD",
  "QUALIFIED",
  "ESTIMATE_REQUESTED",
  "BOOKED",
  "DISPATCHED",
  "IN_PROGRESS",
] as const;

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold ${accent ?? "text-slate-900"}`}
      >
        {value}
      </p>
    </div>
  );
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
          Your account isn&apos;t linked to a business yet.
        </p>
      </div>
    );
  }

  const [customers, openJobs, emergencies, needsHuman, recentJobs] =
    await Promise.all([
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
      prisma.job.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { customer: true, technician: true },
      }),
    ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back, {user.name.split(" ")[0]}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open jobs" value={openJobs} />
        <StatCard
          label="Emergencies"
          value={emergencies}
          accent={emergencies > 0 ? "text-red-600" : "text-slate-900"}
        />
        <StatCard
          label="Needs human reply"
          value={needsHuman}
          accent={needsHuman > 0 ? "text-amber-600" : "text-slate-900"}
        />
        <StatCard label="Customers" value={customers} />
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent jobs</h2>
        </div>
        {recentJobs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No jobs yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Job</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Tech</th>
                <th className="px-5 py-3 font-medium">Urgency</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentJobs.map((job) => (
                <tr key={job.id} className="text-slate-700">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {job.title}
                  </td>
                  <td className="px-5 py-3">{job.customer?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    {job.technician?.name ?? "Unassigned"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        job.urgency === "EMERGENCY"
                          ? "rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                      }
                    >
                      {job.urgency.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {job.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
