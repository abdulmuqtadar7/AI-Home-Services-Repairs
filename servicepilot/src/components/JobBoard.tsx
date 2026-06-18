"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type BoardJob = {
  id: string;
  title: string;
  status: string;
  urgency: string;
  amountCharged: number | null;
  customerName: string | null;
  technicianName: string | null;
  scheduledAt: string | null;
};

const COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["NEW_LEAD", "New lead"],
  ["QUALIFIED", "Qualified"],
  ["ESTIMATE_REQUESTED", "Estimate"],
  ["BOOKED", "Booked"],
  ["DISPATCHED", "Dispatched"],
  ["IN_PROGRESS", "In progress"],
  ["COMPLETED", "Completed"],
  ["PAID", "Paid"],
];
const ALL_STATUSES: ReadonlyArray<readonly [string, string]> = [
  ...COLUMNS,
  ["REVIEW_REQUESTED", "Review requested"],
  ["LOST_CANCELLED", "Lost / cancelled"],
];

const urgencyCls: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  NORMAL: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  EMERGENCY: "bg-red-100 text-red-700",
};

export function JobBoard({ jobs }: { jobs: BoardJob[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const grouped: Record<string, BoardJob[]> = {};
  for (const c of COLUMNS) grouped[c[0]] = [];
  for (const j of jobs) {
    if (!grouped[j.status]) grouped[j.status] = [];
    grouped[j.status].push(j);
  }

  async function move(id: string, status: string) {
    setBusyId(id);
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(([value, label]) => {
        const items = grouped[value] ?? [];
        return (
          <div key={value} className="flex w-72 shrink-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-slate-700">
                {label}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                  No jobs
                </p>
              ) : (
                items.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-700 hover:underline"
                      >
                        {job.title}
                      </Link>
                      <span
                        className={
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase " +
                          (urgencyCls[job.urgency] ??
                            "bg-slate-100 text-slate-600")
                        }
                      >
                        {job.urgency.toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {job.customerName ?? "No customer"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {job.technicianName
                        ? `👷 ${job.technicianName}`
                        : "Unassigned"}
                      {job.amountCharged !== null
                        ? ` · $${job.amountCharged.toFixed(2)}`
                        : ""}
                    </p>
                    <select
                      value={job.status}
                      disabled={busyId === job.id}
                      onChange={(e) => move(job.id, e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 outline-none focus:border-indigo-500"
                    >
                      {ALL_STATUSES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
