import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomerForm, type CustomerInput } from "@/components/CustomerForm";

export const dynamic = "force-dynamic";

function money(n: number) {
  return "$" + n.toFixed(2);
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, businessId },
    include: {
      jobs: { orderBy: { createdAt: "desc" } },
      reviews: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) notFound();

  const initial: CustomerInput = {
    id: customer.id,
    name: customer.name ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    zipCode: customer.zipCode ?? "",
    type: customer.type,
    notes: customer.notes ?? "",
  };

  // Lifetime value + history aggregates.
  const jobs = customer.jobs;
  const paidJobs = jobs.filter((j) => j.status === "PAID");
  const lifetimeValue = paidJobs.reduce(
    (sum, j) => sum + (j.amountCharged ? Number(j.amountCharged) : 0),
    0,
  );
  const avgTicket = paidJobs.length > 0 ? lifetimeValue / paidJobs.length : 0;
  const completedCount = jobs.filter(
    (j) => j.status === "PAID" || j.status === "COMPLETED",
  ).length;
  const firstService = jobs.length > 0 ? jobs[jobs.length - 1].createdAt : null;
  const lastService = jobs.length > 0 ? jobs[0].createdAt : null;

  const reviews = customer.reviews;
  const avgRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10,
        ) / 10
      : null;

  const recentJobs = jobs.slice(0, 10);

  const stats: { label: string; value: string; sub?: string }[] = [
    {
      label: "Lifetime value",
      value: money(lifetimeValue),
      sub: paidJobs.length + " paid",
    },
    { label: "Avg ticket", value: money(avgTicket) },
    {
      label: "Total jobs",
      value: String(jobs.length),
      sub: completedCount + " completed",
    },
    {
      label: "Avg rating",
      value: avgRating === null ? "-" : avgRating.toFixed(1),
      sub: reviews.length + " reviews",
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/customers"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          {"\u2190"} Back to customers
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {customer.name ?? "Unnamed customer"}
          </h1>
          {customer.isReturning ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Returning
            </span>
          ) : null}
        </div>
        {firstService ? (
          <p className="mt-1 text-xs text-slate-500">
            Customer since {firstService.toISOString().slice(0, 10)}
            {lastService
              ? " \u00b7 last service " + lastService.toISOString().slice(0, 10)
              : ""}
          </p>
        ) : null}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {s.value}
            </p>
            {s.sub ? (
              <p className="mt-0.5 text-xs text-slate-400">{s.sub}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="max-w-xl">
          <CustomerForm initial={initial} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent jobs
            </h2>
          </div>
          {recentJobs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No jobs for this customer yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentJobs.map((job) => {
                const amount = job.amountCharged
                  ? money(Number(job.amountCharged))
                  : null;
                return (
                  <li key={job.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {job.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {job.status.replace(/_/g, " ").toLowerCase()}
                          {" \u00b7 "}
                          {job.urgency.toLowerCase()}
                          {" \u00b7 "}
                          {job.createdAt.toISOString().slice(0, 10)}
                        </p>
                      </div>
                      {amount ? (
                        <span className="shrink-0 text-sm font-medium text-slate-700">
                          {amount}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
