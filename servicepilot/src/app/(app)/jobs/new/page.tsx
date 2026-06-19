import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JobForm } from "@/components/JobForm";

export default async function NewJobPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const [business, customers, technicians, services] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { trades: true, niche: true },
    }),
    prisma.customer.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.technician.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, skills: true },
    }),
    prisma.service.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, niche: true },
    }),
  ]);

  const trades: string[] =
    business?.trades && business.trades.length > 0
      ? business.trades
      : business?.niche
        ? [business.niche]
        : [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">New job</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add a job to the pipeline.
        </p>
      </div>
      <div className="max-w-2xl">
        <JobForm
          customers={customers.map((c) => ({
            id: c.id,
            name: c.name ?? "Unnamed",
          }))}
          technicians={technicians}
          services={services}
          trades={trades}
        />
      </div>
    </div>
  );
}
