import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomerForm, type CustomerInput } from "@/components/CustomerForm";

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
    include: { jobs: { orderBy: { createdAt: "desc" }, take: 10 } },
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

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/customers"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← Back to customers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {customer.name ?? "Unnamed customer"}
        </h1>
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
          {customer.jobs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No jobs for this customer yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {customer.jobs.map((job) => (
                <li key={job.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-900">
                    {job.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {job.status.replace(/_/g, " ").toLowerCase()} ·{" "}
                    {job.urgency.toLowerCase()}
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
