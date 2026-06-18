import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const { q } = await searchParams;
  const query = q?.trim();

  const customers = await prisma.customer.findMany({
    where: {
      businessId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { phone: { contains: query } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { jobs: true } } },
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {customers.length} customer{customers.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          New customer
        </Link>
      </div>

      <form className="mb-4">
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search by name, phone, or email…"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {customers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            {query ? "No customers match your search." : "No customers yet."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Jobs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="text-slate-700">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    <Link
                      href={`/customers/${c.id}`}
                      className="hover:text-indigo-700 hover:underline"
                    >
                      {c.name ?? "Unnamed"}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{c.phone ?? "—"}</td>
                  <td className="px-5 py-3">{c.email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {c.type.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3">{c._count.jobs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
