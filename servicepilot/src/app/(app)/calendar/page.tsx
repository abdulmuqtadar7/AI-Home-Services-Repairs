import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import {
  CalendarView,
  type CalTechnician,
  type CalJobOption,
} from "@/components/CalendarView";
import { RemindersButton } from "@/components/RemindersButton";

export const dynamic = "force-dynamic";

function fallbackMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const role = user.memberships[0]?.role;
  if (!can(role, "viewDashboard", { isSuperAdmin: user.isSuperAdmin })) {
    redirect("/jobs");
  }
  const canManage = can(role, "editJobs", { isSuperAdmin: user.isSuperAdmin });

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "")
    ? sp.month!
    : fallbackMonth();

  // Technicians power the create form + the calendar filter. Open jobs can be
  // linked to an appointment so the customer is derived automatically.
  const [technicians, jobs] = await Promise.all([
    prisma.technician.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.job.findMany({
      where: { businessId, status: { notIn: ["LOST_CANCELLED", "PAID"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        customer: { select: { name: true } },
      },
    }),
  ]);

  const techRows: CalTechnician[] = technicians.map((t) => ({
    id: t.id,
    name: t.name,
  }));
  const jobRows: CalJobOption[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    customer: j.customer?.name ?? null,
  }));

  return (
    <div>
      {canManage && (
        <div className="flex items-center justify-end gap-3 px-8 pt-6">
          <span className="text-xs text-slate-500">
            Text customers a reminder for appointments in the next 24h
          </span>
          <RemindersButton withinHours={24} />
        </div>
      )}
      <CalendarView
        month={month}
        technicians={techRows}
        jobs={jobRows}
        canManage={canManage}
      />
    </div>
  );
}
