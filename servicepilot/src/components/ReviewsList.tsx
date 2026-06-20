"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ReviewJob = {
  id: string;
  title: string;
  customerName: string | null;
  amountCharged: number | null;
  status: string;
  reviewRequestedAt: string | null;
};

function money(n: number | null) {
  if (n === null) return null;
  return "$" + n.toFixed(2);
}

export function ReviewsList({
  jobs,
  reviewLink,
  businessName,
  pending,
  requested,
}: {
  jobs: ReviewJob[];
  reviewLink: string | null;
  businessName: string;
  pending: number;
  requested: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(jobs);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function requestReview(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/jobs/${id}/request-review`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not request review");
        return;
      }
      setItems((prev) =>
        prev.map((j) =>
          j.id === id
            ? {
                ...j,
                status: "REVIEW_REQUESTED",
                reviewRequestedAt: new Date().toISOString(),
              }
            : j,
        ),
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function copyMessage(j: ReviewJob) {
    const name = j.customerName || "there";
    const msg = reviewLink
      ? `Hi ${name}, thanks for choosing ${businessName}! If you were happy with our work, we'd really appreciate a quick review: ${reviewLink}`
      : `Hi ${name}, thanks for choosing ${businessName}! If you were happy with our work, we'd really appreciate a quick review.`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedId(j.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-semibold text-slate-900">{pending}</p>
          <p className="text-xs text-slate-500">Awaiting request</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-semibold text-slate-900">{requested}</p>
          <p className="text-xs text-slate-500">Reviews requested</p>
        </div>
      </div>

      {!reviewLink && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Add your Google review link in{" "}
          <a href="/settings" className="font-medium underline">
            Settings
          </a>{" "}
          so the copied message includes a direct link for customers.
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center">
          <p className="text-sm text-slate-500">
            No completed or paid jobs yet. Once a job is marked completed, it
            will show up here so you can ask for a review.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {items.map((j) => {
            const isRequested = j.status === "REVIEW_REQUESTED";
            const amount = money(j.amountCharged);
            return (
              <div
                key={j.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {j.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {j.customerName || "No customer"}
                    {amount ? " \u00b7 " + amount : ""}
                    {isRequested && j.reviewRequestedAt
                      ? " \u00b7 Requested " +
                        new Date(j.reviewRequestedAt).toLocaleDateString()
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyMessage(j)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {copiedId === j.id ? "Copied!" : "Copy message"}
                  </button>
                  {isRequested ? (
                    <span className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
                      Requested
                    </span>
                  ) : (
                    <button
                      onClick={() => requestReview(j.id)}
                      disabled={busyId === j.id}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {busyId === j.id ? "Saving..." : "Request review"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
