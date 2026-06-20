import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/rbac";
import { JobForm, type JobInput } from "@/components/JobForm";
import {
  TechnicianJobView,
  type TechJob,
} from "@/components/TechnicianJobView";

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
  const role = user.memberships[0]?.role;
  const isTechnician =
    !user.isSuperAdmin && normalizeRole(role) === "TECHNICIAN";

  // Technicians get a read-only view with a status-only control, and may only
  // open jobs assigned to them (even by direct URL).
  if (isTechnician) {
    const myTech = await prisma.technician.findFirst({
      where: { businessId, userId: user.id },
      select: { id: true },
    });
    const job = await prisma.job.findFirst({
      where: { id, businessId, technicianId: myTech?.id ?? "__none__" },
      include: {
        customer: { select: { name: true } },
        technician: { select: { name: true } },
        service: { select: { name: true } },
      },
    });
    if (!job) notFound();

    const techJob: TechJob = {
      id: job.id,
      title: job.title,
      status: job.status,
      urgency: job.urgency,
      customerName: job.customer?.name ?? null,
      serviceName: job.service?.name ?? null,
      technicianName: job.technician?.name ?? null,
      problem: job.problem ?? null,
      address: job.address ?? null,
      zipCode: job.zipCode ?? null,
      scheduledAt: job.scheduledAt ? job.scheduledAt.toISOString() : null,
      amountCharged: job.amountCharged ? Number(job.amountCharged) : null,
      customerType: job.customerType,
      notes: job.notes ?? null,
    };

    return (
      <div className="p-8">
        <div className="mb-6">
          <Link
            href="/jobs"
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← Back to my jobs
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {job.title}
          </h1>
        </div>
        <div className="max-w-2xl">
          <TechnicianJobView job={techJob} />
        </div>
      </div>
    );
  }

  const [job, business, customers, technicians, services] = await Promise.all([
    prisma.job.findFirst({ where: { id, businessId } }),
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
  if (!job) notFound();

  const trades: string[] =
    business?.trades && business.trades.length > 0
      ? business.trades
      : business?.niche
        ? [business.niche]
        : [];

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
          trades={trades}
        />
      </div>
    </div>
  );
}
