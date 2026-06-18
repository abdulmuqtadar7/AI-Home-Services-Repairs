"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

type NavItem = { href: string; label: string; ready: boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", ready: true },
  { href: "/inbox", label: "Inbox", ready: true },
  { href: "/jobs", label: "Jobs", ready: true },
  { href: "/customers", label: "Customers", ready: true },
  { href: "/calendar", label: "Calendar", ready: false },
  { href: "/technicians", label: "Technicians", ready: false },
  { href: "/payments", label: "Payments", ready: false },
  { href: "/settings", label: "Settings", ready: false },
];

export function Sidebar({
  businessName,
  userName,
  role,
}: {
  businessName: string;
  userName: string;
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
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

      <div className="mx-3 mb-3 rounded-lg bg-slate-50 px-3 py-2">
        <p className="truncate text-sm font-medium text-slate-800">
          {businessName}
        </p>
        <p className="text-xs text-slate-500">{role}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          if (!item.ready) {
            return (
              <div
                key={item.href}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400"
              >
                <span>{item.label}</span>
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
              {item.label}
            </Link>
          );
        })}
      </nav>

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
