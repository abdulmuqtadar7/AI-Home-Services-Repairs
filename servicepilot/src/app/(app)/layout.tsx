import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = user.memberships[0];

  // A pending tenant hasn't been activated/paid yet -> send them to billing.
  if (
    !user.isSuperAdmin &&
    membership &&
    membership.business.status === "PENDING"
  ) {
    redirect("/billing");
  }

  if (
    !user.isSuperAdmin &&
    membership &&
    !membership.business.onboardingCompleted
  ) {
    redirect("/onboarding");
  }

  // A suspended tenant loses access to the whole app. Super admins are exempt.
  if (
    !user.isSuperAdmin &&
    membership &&
    membership.business.status === "SUSPENDED"
  ) {
    redirect("/suspended");
  }

  // Super-admin context: the business they're acting inside (if any) plus the
  // full list used by the sidebar switcher dropdown.
  const actingBusinessId = user.isSuperAdmin
    ? (user.session.businessId ?? null)
    : null;

  let businessName = membership?.business.name ?? "ServicePilot";
  let businesses: { id: string; name: string }[] = [];

  if (user.isSuperAdmin) {
    businesses = await prisma.business.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    });
    const acting = businesses.find((b) => b.id === actingBusinessId);
    if (acting) businessName = acting.name;
  }

  const role = user.isSuperAdmin
    ? "Super Admin"
    : membership?.role
      ? membership.role.charAt(0) + membership.role.slice(1).toLowerCase()
      : "Member";

  // Raw role key (OWNER/DISPATCHER/TECHNICIAN) the sidebar uses to decide which
  // navigation entries to render. Super admins get owner-level visibility.
  const roleKey = user.isSuperAdmin
    ? "OWNER"
    : (membership?.role ?? "TECHNICIAN");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        businessName={businessName}
        userName={user.name}
        role={role}
        roleKey={roleKey}
        isSuperAdmin={user.isSuperAdmin}
        actingBusinessId={actingBusinessId}
        businesses={businesses}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
