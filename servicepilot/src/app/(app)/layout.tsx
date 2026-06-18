import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = user.memberships[0];

  if (
    !user.isSuperAdmin &&
    membership &&
    !membership.business.onboardingCompleted
  ) {
    redirect("/onboarding");
  }

  const businessName = membership?.business.name ?? "ServicePilot";
  const role = user.isSuperAdmin
    ? "Super Admin"
    : membership?.role
      ? membership.role.charAt(0) + membership.role.slice(1).toLowerCase()
      : "Member";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar businessName={businessName} userName={user.name} role={role} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
