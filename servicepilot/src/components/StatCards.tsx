"use client";

import { useState } from "react";
import Link from "next/link";

export type StatCardDef = {
  label: string;
  value: string | number;
  accent?: string;
  // Job filter querystring (e.g. "status=open"). When set, the card expands
  // an inline list of matching jobs on click.
  query?: string;
  // External destination (e.g. "/inbox"). When set, the card is a plain link.
  href?: string;
};

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

export function StatCards({ cards }: { cards: StatCardDef[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);

  async function toggle(card: StatCardDef) {
    if (!card.query) return;
    if (openKey === card.label) {
      setOpenKey(null);
      return;
    }
    setOpenKey(card.label);
    setLoading(true);
    setError(null);
    setJobs([]);
    try {
      const res = await fetch(`/api/dashboard/jobs?${card.query}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load");
      setJobs(data.jobs as JobRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const openCard = cards.find((c) => c.label === openKey) ?? null;
  const base = "rounded-2xl border bg-white p-5 shadow-sm transition";

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => {
          const isOpen = openKey === card.label;
          const inner = (
            <>
              <p className="text-sm text-slate-500">{card.label}</p>
              <p
                className={`mt-2 text-3xl font-semibold ${
                  card.accent ?? "text-slate-900"
                }`}
              >
                {card.value}
              </p>
            </>
          );
          if (card.href) {
            return (
              <Link
                key={card.label}
                href={card.href}
                className={`${base} block border-slate-200 hover:border-indigo-300 hover:shadow`}
              >
                {inner}
              </Link>
            );
          }
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => toggle(card)}
              className={`${base} block w-full text-left ${
                isOpen
                  ? "border-indigo-400 ring-1 ring-indigo-200"
                  : "border-slate-200 hover:border-indigo-300 hover:shadow"
              }`}
            >
              {inner}
            </button>
          );
        })}
      </div>

      {openCard && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {openCard.label}
              {!loading && !error ? ` (${jobs.length})` : ""}
            </h3>
            <div className="flex items-center gap-3">
              <Link
                href={`/jobs?${openCard.query}`}
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
                      {job.status.replace(/_/g, " ").toLowerCase()}
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
