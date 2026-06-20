import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/jwt";
import { can, landingPath } from "@/lib/rbac";
import { WidgetSnippet } from "@/components/WidgetSnippet";

export const dynamic = "force-dynamic";

export default async function WebsiteWidgetPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/login");
  if (
    !can(session.role, "manageSettings", {
      isSuperAdmin: session.isSuperAdmin,
    })
  ) {
    redirect(landingPath(session.role, session.isSuperAdmin));
  }
  const businessId = session.businessId;
  if (!businessId) redirect("/dashboard");

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, status: true },
  });
  if (!business) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Website widget
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Add your AI receptionist to any website. Visitors get a chat bubble
          that books jobs and answers questions 24/7.
        </p>
      </header>
      <WidgetSnippet
        businessId={business.id}
        businessName={business.name}
        active={business.status === "ACTIVE"}
        fallbackOrigin={process.env.NEXT_PUBLIC_APP_URL ?? ""}
      />
    </div>
  );
}
