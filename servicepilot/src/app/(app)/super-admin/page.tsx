import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SwitchBusinessButton } from "./SwitchBusinessButton";

export default async function SuperAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) redirect("/dashboard");

  const [businesses, users, jobs, recentBusinesses] = await Promise.all([
    prisma.business.count(),
    prisma.user.count(),
    prisma.job.count(),
    prisma.business.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { _count: { select: { members: true, jobs: true } } },
    }),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Platform overview
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Super admin view across all tenants.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Businesses</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {businesses}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Users</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{users}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total jobs</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{jobs}</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Businesses</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Niche</th>
              <th className="px-5 py-3 font-medium">Members</th>
              <th className="px-5 py-3 font-medium">Jobs</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recentBusinesses.map((b) => (
              <tr key={b.id} className="text-slate-700">
                <td className="px-5 py-3 font-medium text-slate-900">
                  {b.name}
                </td>
                <td className="px-5 py-3">{b.niche.toLowerCase()}</td>
                <td className="px-5 py-3">{b._count.members}</td>
                <td className="px-5 py-3">{b._count.jobs}</td>
                <td className="px-5 py-3">
                  <SwitchBusinessButton businessId={b.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
