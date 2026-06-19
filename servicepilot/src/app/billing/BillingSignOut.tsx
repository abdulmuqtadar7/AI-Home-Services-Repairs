"use client";

import { useState } from "react";

export default function BillingSignOut() {
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors; cookie clears server-side on success
    } finally {
      // Full navigation so middleware re-reads the cleared session cookie.
      window.location.href = "/login";
    }
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-60"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
