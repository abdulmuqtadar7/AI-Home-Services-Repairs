"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "ACTIVE" | "PENDING" | "SUSPENDED";

export default function BusinessAdminActions({
  businessId,
  businessName,
  status,
}: {
  businessId: string;
  businessName: string;
  status: Status;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(
    url: string,
    body: Record<string, unknown>,
    key: string,
  ): Promise<{ ok: boolean; data: Record<string, unknown> | null }> {
    setLoading(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Something went wrong.");
        return { ok: false, data };
      }
      return { ok: true, data };
    } catch {
      setError("Network error. Please try again.");
      return { ok: false, data: null };
    } finally {
      setLoading(null);
    }
  }

  async function setStatus(next: Status, key: string) {
    const { ok } = await call(
      "/api/super-admin/set-business-status",
      { businessId, status: next },
      key,
    );
    if (ok) router.refresh();
  }

  async function remove() {
    const confirmed = window.confirm(
      `Delete "${businessName}"? This permanently wipes all of their data and cannot be undone.`,
    );
    if (!confirmed) return;
    const { ok } = await call(
      "/api/super-admin/delete-business",
      { businessId },
      "delete",
    );
    if (ok) router.refresh();
  }

  async function openWorkspace() {
    const { ok, data } = await call(
      "/api/super-admin/switch-business",
      { businessId },
      "open",
    );
    if (ok) {
      const redirect = (data && (data.redirect as string)) || "/dashboard";
      window.location.href = redirect;
    }
  }

  const busy = loading !== null;
  const base =
    "rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === "PENDING" && (
          <>
            <button
              onClick={() => setStatus("ACTIVE", "approve")}
              disabled={busy}
              className={`${base} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              {loading === "approve" ? "Approving…" : "Approve"}
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className={`${base} border border-rose-300 text-rose-700 hover:bg-rose-50`}
            >
              {loading === "delete" ? "Declining…" : "Decline"}
            </button>
          </>
        )}

        {status === "ACTIVE" && (
          <>
            <button
              onClick={openWorkspace}
              disabled={busy}
              className={`${base} border border-slate-300 text-slate-700 hover:bg-slate-50`}
            >
              {loading === "open" ? "Opening…" : "Open workspace"}
            </button>
            <button
              onClick={() => setStatus("SUSPENDED", "suspend")}
              disabled={busy}
              className={`${base} border border-amber-300 text-amber-700 hover:bg-amber-50`}
            >
              {loading === "suspend" ? "Suspending…" : "Suspend"}
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className={`${base} border border-rose-300 text-rose-700 hover:bg-rose-50`}
            >
              {loading === "delete" ? "Deleting…" : "Delete"}
            </button>
          </>
        )}

        {status === "SUSPENDED" && (
          <>
            <button
              onClick={openWorkspace}
              disabled={busy}
              className={`${base} border border-slate-300 text-slate-700 hover:bg-slate-50`}
            >
              {loading === "open" ? "Opening…" : "Open workspace"}
            </button>
            <button
              onClick={() => setStatus("ACTIVE", "reactivate")}
              disabled={busy}
              className={`${base} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              {loading === "reactivate" ? "Reactivating…" : "Reactivate"}
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className={`${base} border border-rose-300 text-rose-700 hover:bg-rose-50`}
            >
              {loading === "delete" ? "Deleting…" : "Delete"}
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
