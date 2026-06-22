"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DispatchTechnician = { id: string; name: string };

type TechSuggestion = {
  id: string;
  name: string;
  score: number;
  skillMatch: boolean;
  openJobs: number;
  reasons: string[];
};

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
  const [suggestions, setSuggestions] = useState<TechSuggestion[]>([]);

  const alreadyDispatched = DISPATCHED_OR_LATER.has(status);

  useEffect(() => {
    let active = true;
    fetch(`/api/jobs/${jobId}/suggest-tech`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.suggestions) {
          setSuggestions(data.suggestions.slice(0, 3));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [jobId]);

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

      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Suggested techs
          </p>
          <ul className="mt-2 space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {s.name}
                    {s.skillMatch && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        skill match
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {s.reasons.join(", ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    selected === s.id
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-300 text-slate-700 hover:bg-white"
                  }`}
                >
                  {selected === s.id ? "Selected" : "Use"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
