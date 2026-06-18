import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JobForm, type JobInput } from "@/components/JobForm";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const { id } = await params;
  const [job, customers, technicians, services] = await Promise.all([
    prisma.job.findFirst({ where: { id, businessId } }),
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
      select: { id: true, name: true },
    }),
  ]);
  if (!job) notFound();

  const initial: JobInput = {
    id: job.id,
    title: job.title,
    customerId: job.customerId ?? "",
    serviceId: job.serviceId ?? "",
    technicianId: job.technicianId ?? "",
    problem: job.problem ?? "",
    address: job.address ?? "",
    zipCode: job.zipCode ?? "",
    urgency: job.urgency,
    status: job.status,
    customerType: job.customerType,
    scheduledAt: job.scheduledAt
      ? job.scheduledAt.toISOString().slice(0, 16)
      : "",
    amountCharged: job.amountCharged ? String(job.amountCharged) : "",
    notes: job.notes ?? "",
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/jobs"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← Back to jobs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {job.title}
        </h1>
      </div>
      <div className="max-w-2xl">
        <JobForm
          initial={initial}
          customers={customers.map((c) => ({
            id: c.id,
            name: c.name ?? "Unnamed",
          }))}
          technicians={technicians}
          services={services}
        />
      </div>
    </div>
  );
}
