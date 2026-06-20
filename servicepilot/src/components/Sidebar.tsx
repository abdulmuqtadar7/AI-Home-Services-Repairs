"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { can, normalizeRole, type Capability } from "@/lib/rbac";

type NavItem = {
  href: string;
  label: string;
  ready: boolean;
  // Capability required to see this entry. null = visible to every role
  // (the Jobs entry, which technicians see as a filtered "My Jobs").
  cap: Capability | null;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", ready: true, cap: "viewDashboard" },
  { href: "/inbox", label: "Inbox", ready: true, cap: "viewInbox" },
  { href: "/chatbot", label: "AI Chatbot", ready: true, cap: "viewChatbot" },
  { href: "/jobs", label: "Jobs", ready: true, cap: null },
  { href: "/customers", label: "Customers", ready: true, cap: "viewCustomers" },
  { href: "/calendar", label: "Calendar", ready: true, cap: "viewDashboard" },
  {
    href: "/technicians",
    label: "Technicians",
    ready: true,
    cap: "manageTechnicians",
  },
  { href: "/payments", label: "Payments", ready: false, cap: "manageBilling" },
  { href: "/settings", label: "Settings", ready: true, cap: "manageSettings" },
];

const PLATFORM_NAV: { href: string; label: string; exact: boolean }[] = [
  { href: "/super-admin", label: "Home", exact: true },
  { href: "/super-admin/businesses", label: "Businesses", exact: false },
  { href: "/super-admin/new", label: "Register business", exact: false },
];

type Business = { id: string; name: string };

export function Sidebar({
  businessName,
  userName,
  role,
  roleKey,
  isSuperAdmin,
  actingBusinessId,
  businesses,
}: {
  businessName: string;
  userName: string;
  role: string;
  roleKey: string;
  isSuperAdmin: boolean;
  actingBusinessId: string | null;
  businesses: Business[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const onPlatformAdmin =
    pathname === "/super-admin" || pathname.startsWith("/super-admin/");
  const platformMode = isSuperAdmin && onPlatformAdmin;
  const inBusinessMode = isSuperAdmin && !onPlatformAdmin && !!actingBusinessId;

  // Only show the nav entries this role is allowed to use. Super admins acting
  // inside a business see everything (owner-level).
  const isTechnician = !isSuperAdmin && normalizeRole(roleKey) === "TECHNICIAN";
  const visibleNav = NAV.filter((item) =>
    item.cap === null ? true : can(roleKey, item.cap, { isSuperAdmin }),
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  async function switchTo(id: string) {
    if (id === actingBusinessId) {
      setSwitcherOpen(false);
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setSwitching(true);
    const res = await fetch("/api/super-admin/switch-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: id }),
    });
    const data = await res.json().catch(() => ({}));
    setSwitching(false);
    setSwitcherOpen(false);
    if (!res.ok) {
      alert(data.error || "Could not switch business");
      return;
    }
    router.push(data.redirect || "/dashboard");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          S
        </div>
        <span className="text-sm font-semibold text-slate-900">
          ServicePilot
        </span>
      </div>

      {platformMode ? (
        <>
          <div className="mx-3 mb-3 rounded-lg bg-indigo-50 px-3 py-2">
            <p className="truncate text-sm font-medium text-indigo-800">
              Platform Admin
            </p>
            <p className="text-xs text-indigo-500">{role}</p>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {PLATFORM_NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "block rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </>
      ) : (
        <>
          {inBusinessMode ? (
            <div className="mx-3 mb-3 space-y-2">
              <Link
                href="/super-admin"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <span>←</span>
                <span>Platform Admin</span>
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSwitcherOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Viewing
                    </span>
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {businessName}
                    </span>
                  </span>
                  <span className="ml-2 text-slate-400">▾</span>
                </button>
                {switcherOpen && (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {businesses.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-400">
                        No businesses
                      </p>
                    ) : (
                      businesses.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          disabled={switching}
                          onClick={() => switchTo(b.id)}
                          className={clsx(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-50",
                            b.id === actingBusinessId
                              ? "font-medium text-indigo-700"
                              : "text-slate-700",
                          )}
                        >
                          <span className="truncate">{b.name}</span>
                          {b.id === actingBusinessId && (
                            <span className="ml-2 text-indigo-600">✓</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mx-3 mb-3 rounded-lg bg-slate-50 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-800">
                {businessName}
              </p>
              <p className="text-xs text-slate-500">{role}</p>
            </div>
          )}

          <nav className="flex-1 space-y-1 px-3">
            {visibleNav.map((item) => {
              const label =
                item.href === "/jobs" && isTechnician ? "My Jobs" : item.label;
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              if (!item.ready) {
                return (
                  <div
                    key={item.href}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400"
                  >
                    <span>{label}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      soon
                    </span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "block rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </>
      )}

      <div className="border-t border-slate-200 p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium text-slate-800">
            {userName}
          </p>
        </div>
        <button
          onClick={logout}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-red-600"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
