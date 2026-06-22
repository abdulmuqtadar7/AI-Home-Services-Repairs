"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DispatchTechnician = { id: string; name: string };

const DISPATCHED_OR_LATER = new Set([
  "DISPATCHED",
  "IN_PROGRESS",
  "COMPLETED",
  "PAID",
  "REVIEW_REQUESTED",
]);

export function DispatchPanel({
  jobId,
  status,
  technicianId,
  technicians,
}: {
  jobId: string;
  status: string;
  technicianId: string;
  technicians: DispatchTechnician[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(technicianId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const alreadyDispatched = DISPATCHED_OR_LATER.has(status);

  async function dispatch() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected ? { technicianId: selected } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not dispatch this job.");
        return;
      }
      const techName = data?.technician?.name ?? "the technician";
      const sms = data?.sent ? " Text sent." : "";
      setMessage("Dispatched to " + techName + "." + sms);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Dispatch</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {alreadyDispatched
              ? "This job is dispatched. You can reassign or re-send the alert."
              : "Assign a technician and send them the job."}
          </p>
        </div>
        {alreadyDispatched && (
          <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
            Dispatched
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">Select technician</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={dispatch}
          disabled={loading || !selected}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading
            ? "Dispatching..."
            : alreadyDispatched
              ? "Re-dispatch"
              : "Dispatch"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
    </div>
  );
}
