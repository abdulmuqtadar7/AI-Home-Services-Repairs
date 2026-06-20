"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type CalJob = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string;
  customer: string | null;
  technician: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  NEW_LEAD: "bg-slate-100 text-slate-700",
  QUALIFIED: "bg-sky-100 text-sky-700",
  ESTIMATE_REQUESTED: "bg-amber-100 text-amber-700",
  BOOKED: "bg-indigo-100 text-indigo-700",
  DISPATCHED: "bg-violet-100 text-violet-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  PAID: "bg-green-100 text-green-700",
  REVIEW_REQUESTED: "bg-teal-100 text-teal-700",
  LOST_CANCELLED: "bg-rose-100 text-rose-700",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  let h = d.getUTCHours();
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

export function CalendarView({
  month,
  jobs,
}: {
  month: string;
  jobs: CalJob[];
}) {
  const [year, mon] = month.split("-").map(Number);
  const [selected, setSelected] = useState<string | null>(null);

  // Group jobs by their UTC calendar day (YYYY-MM-DD).
  const byDay = useMemo(() => {
    const map = new Map<string, CalJob[]>();
    for (const j of jobs) {
      const day = j.scheduledAt.slice(0, 10);
      const list = map.get(day);
      if (list) list.push(j);
      else map.set(day, [j]);
    }
    return map;
  }, [jobs]);

  // Build the grid cells (leading blanks + each day of the month).
  const cells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const out: Array<{ day: number; date: string } | null> = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      out.push({ day: d, date });
    }
    return out;
  }, [year, mon, month]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const thisMonth = `${new Date().getUTCFullYear()}-${String(
    new Date().getUTCMonth() + 1,
  ).padStart(2, "0")}`;

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const selectedJobs = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Scheduled jobs for {MONTH_NAMES[mon - 1]} {year}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${prev}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Prev
          </Link>
          <Link
            href={`/calendar?month=${thisMonth}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${next}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-sm shadow-sm">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="bg-slate-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {w}
          </div>
        ))}

        {cells.map((cell, i) => {
          if (!cell) {
            return (
              <div key={`blank-${i}`} className="min-h-28 bg-slate-50/60" />
            );
          }
          const dayJobs = byDay.get(cell.date) ?? [];
          const isToday = cell.date === todayIso;
          const isSelected = cell.date === selected;
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setSelected(isSelected ? null : cell.date)}
              className={`min-h-28 bg-white p-1.5 text-left align-top transition hover:bg-slate-50 ${
                isSelected ? "ring-2 ring-inset ring-indigo-500" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? "bg-indigo-600 text-white" : "text-slate-600"
                  }`}
                >
                  {cell.day}
                </span>
                {dayJobs.length > 0 && (
                  <span className="text-[10px] font-medium text-slate-400">
                    {dayJobs.length}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {dayJobs.slice(0, 3).map((j) => (
                  <div
                    key={j.id}
                    className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      STATUS_STYLES[j.status] ?? "bg-slate-100 text-slate-700"
                    }`}
                    title={j.title}
                  >
                    {timeLabel(j.scheduledAt)} {j.title}
                  </div>
                ))}
                {dayJobs.length > 3 && (
                  <div className="px-1 text-[10px] text-slate-400">
                    +{dayJobs.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900">{selected}</h2>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>
          {selectedJobs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No jobs scheduled on this day.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {selectedJobs.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/jobs/${j.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">
                        {j.title}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {timeLabel(j.scheduledAt)}
                        {j.customer ? ` · ${j.customer}` : ""}
                        {j.technician ? ` · ${j.technician}` : ""}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[j.status] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {statusLabel(j.status)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {jobs.length === 0 && (
        <p className="mt-4 text-center text-sm text-slate-400">
          No jobs scheduled this month.
        </p>
      )}
    </div>
  );
}
