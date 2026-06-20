import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { CalendarView, type CalJob } from "@/components/CalendarView";

export const dynamic = "force-dynamic";

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
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

  const sp = await searchParams;
  const now = new Date();
  const fallback = `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : fallback;
  const { start, end } = monthRange(month);

  const jobs = await prisma.job.findMany({
    where: { businessId, scheduledAt: { gte: start, lt: end } },
    orderBy: { scheduledAt: "asc" },
    include: {
      customer: { select: { name: true } },
      technician: { select: { name: true } },
    },
  });

  const calJobs: CalJob[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    scheduledAt: j.scheduledAt!.toISOString(),
    customer: j.customer?.name ?? null,
    technician: j.technician?.name ?? null,
  }));

  return <CalendarView month={month} jobs={calJobs} />;
}
