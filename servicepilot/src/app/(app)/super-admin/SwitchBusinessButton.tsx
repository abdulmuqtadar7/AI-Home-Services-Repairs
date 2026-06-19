"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SwitchBusinessButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    const res = await fetch("/api/super-admin/switch-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Could not open workspace.");
      return;
    }
    router.push(data.redirect || "/dashboard");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
    >
      {loading ? "Opening..." : "Open workspace"}
    </button>
  );
}
