import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RequestAccessButton from "./RequestAccessButton";
import BillingSignOut from "./BillingSignOut";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businessId = user.session.businessId;
  if (!businessId) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, status: true, accessRequestedAt: true },
  });
  if (!business) redirect("/login");
  if (business.status === "ACTIVE") redirect("/dashboard");
  if (business.status === "SUSPENDED") redirect("/suspended");

  // status === "PENDING": account created but not activated/paid yet.
  const features = [
    "24/7 AI receptionist & website chatbot",
    "Missed-call text-back & unified inbox",
    "AI lead qualification & booking",
    "Jobs pipeline, dashboards & reviews",
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Pending activation
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">
          Activate {business.name}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account is created, but services are locked until your
          subscription is confirmed. Once payment is verified, everything below
          turns on automatically.
        </p>

        <ul className="mt-6 space-y-2">
          {features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 text-sm text-slate-700"
            >
              <span className="mt-0.5 text-slate-400">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <RequestAccessButton
            alreadyRequested={Boolean(business.accessRequestedAt)}
          />
          <p className="mt-3 text-center text-xs text-slate-500">
            Online payment is coming soon. For now, request access and our team
            will confirm your subscription and unlock your account.
          </p>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <BillingSignOut />
        </div>
      </div>
    </div>
  );
}
