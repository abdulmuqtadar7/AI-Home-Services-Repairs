"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ReviewInsightData = {
  total: number;
  averageRating: number;
  routedToGoogle: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    unanalyzed: number;
  };
  topThemes: { theme: string; count: number }[];
  recent: {
    rating: number;
    sentiment: string | null;
    comment: string;
    createdAt: string;
  }[];
  pendingAnalysis: number;
};

function Stars({ rating }: { rating: number }) {
  const r = Math.max(0, Math.min(5, rating));
  return (
    <span className="text-amber-400">
      {"\u2605".repeat(r)}
      <span className="text-slate-200">{"\u2605".repeat(5 - r)}</span>
    </span>
  );
}

const SENTIMENT_STYLES: Record<string, string> = {
  positive: "bg-green-50 text-green-700",
  neutral: "bg-slate-100 text-slate-600",
  negative: "bg-red-50 text-red-700",
};

export function ReviewInsights({ data }: { data: ReviewInsightData }) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews/analyze", { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) {
        throw new Error(result.error || "Could not analyze reviews");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze reviews");
    } finally {
      setAnalyzing(false);
    }
  }

  if (data.total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
        <p className="text-sm text-slate-500">
          No customer feedback captured yet. When a customer submits the
          feedback form, their rating and comments will appear here with AI
          insights.
        </p>
      </div>
    );
  }

  const s = data.sentiment;
  const sentimentTotal = s.positive + s.neutral + s.negative;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Customer feedback insights
        </h2>
        <button
          onClick={analyze}
          disabled={analyzing}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          {analyzing
            ? "Analyzing..."
            : data.pendingAnalysis > 0
              ? "Analyze " + data.pendingAnalysis + " new"
              : "Refresh insights"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-semibold text-slate-900">{data.total}</p>
          <p className="text-xs text-slate-500">Feedback received</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-semibold text-slate-900">
            {data.averageRating.toFixed(1)}
          </p>
          <div className="text-xs">
            <Stars rating={Math.round(data.averageRating)} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-semibold text-slate-900">
            {data.routedToGoogle}
          </p>
          <p className="text-xs text-slate-500">Sent to Google</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sentiment
          </p>
          {sentimentTotal === 0 ? (
            <p className="text-sm text-slate-500">
              Not analyzed yet. Click Analyze to generate insights.
            </p>
          ) : (
            <div className="space-y-2">
              {(["positive", "neutral", "negative"] as const).map((key) => {
                const value = s[key];
                const pct = Math.round((value / sentimentTotal) * 100);
                const bar =
                  key === "positive"
                    ? "h-full bg-green-400"
                    : key === "neutral"
                      ? "h-full bg-slate-300"
                      : "h-full bg-red-400";
                const barStyle = { width: pct + "%" };
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-16 text-xs capitalize text-slate-600">
                      {key}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={bar} style={barStyle} />
                    </div>
                    <span className="w-8 text-right text-xs text-slate-500">
                      {value}
                    </span>
                  </div>
                );
              })}
              {s.unanalyzed > 0 ? (
                <p className="pt-1 text-xs text-slate-400">
                  {s.unanalyzed} not analyzed yet
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Top themes
          </p>
          {data.topThemes.length === 0 ? (
            <p className="text-sm text-slate-500">No themes extracted yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.topThemes.map((t) => (
                <span
                  key={t.theme}
                  className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium capitalize text-indigo-700"
                >
                  {t.theme}
                  <span className="ml-1 text-indigo-400">{t.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.recent.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recent comments
          </p>
          <div className="divide-y divide-slate-100">
            {data.recent.map((r, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Stars rating={r.rating} />
                  <div className="flex items-center gap-2">
                    {r.sentiment ? (
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs font-medium capitalize " +
                          (SENTIMENT_STYLES[r.sentiment] ||
                            "bg-slate-100 text-slate-600")
                        }
                      >
                        {r.sentiment}
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-400">
                      {r.createdAt.slice(0, 10)}
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-slate-700">{r.comment}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
