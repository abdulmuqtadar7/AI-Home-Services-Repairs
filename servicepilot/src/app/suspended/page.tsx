"use client";

import { useRouter } from "next/navigation";

export default function SuspendedPage() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
          ⏸
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          Account suspended
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Access to this workspace has been paused. Please contact your
          ServicePilot account manager to restore service.
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
