import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BusinessAdminActions from "./BusinessAdminActions";

export const dynamic = "force-dynamic";

type Status = "ACTIVE" | "PENDING" | "SUSPENDED";

const STATUS_BADGE: Record<Status, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  SUSPENDED: "bg-rose-100 text-rose-800",
};

function niceNiche(n: string) {
  return n
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function fmtDate(d: Date | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ManageBusinessesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) redirect("/dashboard");

  const businesses = await prisma.business.findMany({
    orderBy: [{ accessRequestedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      niche: true,
      status: true,
      accessRequestedAt: true,
      createdAt: true,
      _count: { select: { members: true, jobs: true } },
    },
  });

  const pending = businesses.filter((b) => b.status === "PENDING");
  const active = businesses.filter((b) => b.status !== "PENDING");

  return (
    <div className="mx-auto max-w-5xl p-6 sm:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          Manage businesses
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Approve new signups, suspend or reactivate service, and remove
          businesses.
        </p>
      </header>

      {/* Access requests */}
      <section className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Access requests
          </h2>
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No pending signups right now. New accounts that sign up will appear
            here for approval.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((b) => (
              <li
                key={b.id}
                className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{b.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[b.status as Status]}`}
                    >
                      {b.status}
                    </span>
                    {b.accessRequestedAt && (
                      <span className="text-xs font-medium text-amber-700">
                        • Requested access {fmtDate(b.accessRequestedAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {niceNiche(b.niche)}
                    {b.email ? ` · ${b.email}` : ""}
                    {b.phone ? ` · ${b.phone}` : ""}
                    {" · "}
                    Signed up {fmtDate(b.createdAt)}
                  </div>
                </div>
                <BusinessAdminActions
                  businessId={b.id}
                  businessName={b.name}
                  status={b.status as Status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* All businesses */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Businesses
        </h2>
        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No active businesses yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {active.map((b) => (
              <li
                key={b.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{b.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[b.status as Status]}`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {niceNiche(b.niche)} · {b._count.members} member
                    {b._count.members === 1 ? "" : "s"} · {b._count.jobs} job
                    {b._count.jobs === 1 ? "" : "s"}
                  </div>
                </div>
                <BusinessAdminActions
                  businessId={b.id}
                  businessName={b.name}
                  status={b.status as Status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
