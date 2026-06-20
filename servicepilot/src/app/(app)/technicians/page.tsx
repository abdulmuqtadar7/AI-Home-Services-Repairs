import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import {
  TechniciansManager,
  type TechRow,
  type LinkableUser,
} from "@/components/TechniciansManager";

export const dynamic = "force-dynamic";

export default async function TechniciansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/onboarding");

  const role = user.memberships[0]?.role;
  if (!can(role, "manageTechnicians", { isSuperAdmin: user.isSuperAdmin })) {
    redirect("/dashboard");
  }

  const [technicians, members] = await Promise.all([
    prisma.technician.findMany({
      where: { businessId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { jobs: true } },
      },
    }),
    prisma.businessMember.findMany({
      where: { businessId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const linkedUserIds = new Set(
    technicians.map((t) => t.userId).filter(Boolean) as string[],
  );

  const rows: TechRow[] = technicians.map((t) => ({
    id: t.id,
    name: t.name,
    phone: t.phone,
    email: t.email,
    skills: t.skills,
    active: t.active,
    jobCount: t._count.jobs,
    user: t.user
      ? { id: t.user.id, name: t.user.name, email: t.user.email }
      : null,
  }));

  // Staff logins not yet linked to any technician (role shown for context).
  const linkableUsers: LinkableUser[] = members
    .filter((m) => m.user && !linkedUserIds.has(m.user.id))
    .map((m) => ({
      id: m.user!.id,
      name: m.user!.name,
      email: m.user!.email,
      role: m.role,
    }));

  return (
    <TechniciansManager initialRows={rows} linkableUsers={linkableUsers} />
  );
}
