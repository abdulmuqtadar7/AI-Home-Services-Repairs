"use client";

import { useState } from "react";
import Link from "next/link";

type Stage = { key: string; label: string; count: number };

type JobRow = {
  id: string;
  title: string;
  status: string;
  urgency: string;
  customer: string | null;
  technician: string | null;
  amountCharged: number | null;
};

function money(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function PipelineTiles({ stages }: { stages: Stage[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);

  async function toggle(stage: Stage) {
    if (openKey === stage.key) {
      setOpenKey(null);
      return;
    }
    setOpenKey(stage.key);
    setLoading(true);
    setError(null);
    setJobs([]);
    try {
      const res = await fetch(`/api/dashboard/jobs?status=${stage.key}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load");
      setJobs(data.jobs as JobRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const openStage = stages.find((s) => s.key === openKey) ?? null;

  return (
    <div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stages.map((stage) => {
          const isOpen = openKey === stage.key;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => toggle(stage)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                isOpen
                  ? "border-indigo-400 bg-white ring-1 ring-indigo-200"
                  : "border-slate-100 bg-slate-50 hover:border-indigo-300 hover:bg-white"
              }`}
            >
              <p className="text-2xl font-semibold text-slate-900">
                {stage.count}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{stage.label}</p>
            </button>
          );
        })}
      </div>

      {openStage && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {openStage.label}
              {!loading && !error ? ` (${jobs.length})` : ""}
            </h3>
            <div className="flex items-center gap-3">
              <Link
                href={`/jobs?status=${openStage.key}`}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Open in Jobs
              </Link>
              <button
                type="button"
                onClick={() => setOpenKey(null)}
                className="text-xs font-medium text-slate-400 hover:text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Loading...
            </p>
          ) : error ? (
            <p className="px-5 py-8 text-center text-sm text-red-600">
              {error}
            </p>
          ) : jobs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Nothing here right now.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {job.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {job.customer ?? "No customer"}
                      {" - "}
                      {job.urgency.toLowerCase()}
                      {job.technician ? " - " + job.technician : ""}
                    </p>
                  </div>
                  {job.amountCharged ? (
                    <span className="shrink-0 text-sm font-medium text-emerald-600">
                      {money(job.amountCharged)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
