import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/login");

  const role = user.memberships?.[0]?.role;
  if (!can(role, "manageSettings", { isSuperAdmin: user.isSuperAdmin })) {
    redirect("/dashboard");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { aiSetting: true },
  });
  if (!business) redirect("/login");

  const initial = {
    business: {
      name: business.name,
      niche: business.niche,
      trades: business.trades,
      phone: business.phone ?? "",
      email: business.email ?? "",
      website: business.website ?? "",
      emergencyAvailable: business.emergencyAvailable,
      diagnosticFee: business.diagnosticFee
        ? Number(business.diagnosticFee)
        : null,
      googleReviewLink: business.googleReviewLink ?? "",
    },
    ai: {
      personaName: business.aiSetting?.personaName ?? "Assistant",
      tone: business.aiSetting?.tone ?? "friendly",
      greeting: business.aiSetting?.greeting ?? "",
      systemPromptOverride: business.aiSetting?.systemPromptOverride ?? "",
      bookingEnabled: business.aiSetting?.bookingEnabled ?? true,
      collectPhotos: business.aiSetting?.collectPhotos ?? true,
      emergencyKeywords: business.aiSetting?.emergencyKeywords ?? [],
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your AI assistant and business profile.
        </p>
      </div>
      <SettingsForm initial={initial} />
    </div>
  );
}
