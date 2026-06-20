import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ServiceCatalog } from "@/components/ServiceCatalog";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/login");

  const role = user.memberships?.[0]?.role;
  if (!can(role, "manageSettings", { isSuperAdmin: user.isSuperAdmin })) {
    redirect("/dashboard");
  }

  const serviceRows = await prisma.service.findMany({
    where: { businessId },
    orderBy: [{ niche: "asc" }, { name: "asc" }],
  });
  const services = serviceRows.map((s) => ({
    id: s.id,
    name: s.name,
    niche: s.niche,
    description: s.description,
    basePrice: s.basePrice != null ? Number(s.basePrice) : null,
    durationMin: s.durationMin,
    active: s.active,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Service catalog
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the services and prices your AI assistant uses to quote and
          book jobs.
        </p>
      </div>
      <ServiceCatalog initial={services} />
    </div>
  );
}
