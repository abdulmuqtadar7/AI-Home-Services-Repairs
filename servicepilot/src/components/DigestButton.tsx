"use client";

import { useState } from "react";

type DigestSummary = {
  newLeads: number;
  jobsCompleted: number;
  revenue: number;
  missedCallsRecovered: number;
  reviewsRequested: number;
  upcomingAppointments: number;
};

export function DigestButton() {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sms, setSms] = useState(false);
  const [sent, setSent] = useState(false);

  async function run() {
    setLoading(true);
    setText(null);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/digest/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendSms: sms }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        sent?: boolean;
        summary?: DigestSummary;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not build the digest.");
        return;
      }
      setText(data.text ?? "");
      setSent(Boolean(data.sent));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={sms}
            onChange={(e) => setSms(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          Also text my business phone
        </label>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Building..." : "Weekly digest"}
        </button>
      </div>
      {text && (
        <p className="max-w-md text-right text-xs text-slate-600">
          {text}
          {sent ? " (texted)" : ""}
        </p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
