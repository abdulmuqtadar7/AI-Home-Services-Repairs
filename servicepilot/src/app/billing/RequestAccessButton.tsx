"use client";

import { useState } from "react";

export default function RequestAccessButton({
  alreadyRequested,
}: {
  alreadyRequested: boolean;
}) {
  const [requested, setRequested] = useState(alreadyRequested);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestAccess() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/request-access", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setRequested(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (requested) {
    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
        Request received — we’ll confirm your subscription and unlock your
        account shortly.
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={requestAccess}
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {loading ? "Sending…" : "Request access"}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
