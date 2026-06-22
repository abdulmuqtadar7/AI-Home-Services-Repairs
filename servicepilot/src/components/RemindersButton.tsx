"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RemindersButton({
  withinHours = 24,
}: {
  withinHours?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/appointments/reminders/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withinHours }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not send reminders.");
        return;
      }
      setMessage(
        data.sent +
          " sent, " +
          data.skipped +
          " skipped, " +
          data.failed +
          " failed (of " +
          data.considered +
          " due in " +
          data.withinHours +
          "h).",
      );
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send reminders"}
      </button>
      {message && <span className="text-xs text-emerald-600">{message}</span>}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
