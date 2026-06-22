"use client";

import { useState } from "react";

type Props = {
  jobId: string;
  businessName: string;
  customerName: string | null;
  jobTitle: string;
};

const STARS = [1, 2, 3, 4, 5];

export function FeedbackForm({
  jobId,
  businessName,
  customerName,
  jobTitle,
}: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (rating < 1) {
      setError("Please pick a star rating first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Something went wrong");
      }
      if (data.routedToGoogle && data.googleReviewLink) {
        window.location.href = data.googleReviewLink;
        return;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-4xl">{"\u2605"}</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">
          Thank you{customerName ? ", " + customerName : ""}!
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          We really appreciate your feedback. The team at {businessName} will
          use it to keep getting better.
        </p>
      </div>
    );
  }

  const active = hover || rating;
  const lowRating = rating > 0 && rating <= 3;

  return (
    <div>
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-900">How did we do?</h1>
        <p className="mt-1 text-sm text-slate-500">
          {businessName}
          {" - "}
          {jobTitle}
        </p>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {STARS.map((s) => (
          <button
            key={s}
            type="button"
            aria-label={s + " star" + (s === 1 ? "" : "s")}
            onClick={() => setRating(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className={`text-4xl leading-none transition ${
              s <= active ? "text-amber-400" : "text-slate-200"
            }`}
          >
            {"\u2605"}
          </button>
        ))}
      </div>

      <label className="mt-6 block text-sm font-medium text-slate-700">
        {lowRating
          ? "Sorry we missed the mark. What went wrong?"
          : "Anything you'd like to add? (optional)"}
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-indigo-400 focus:outline-none"
        placeholder="Tell us about your experience..."
      />

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit feedback"}
      </button>

      <p className="mt-3 text-center text-xs text-slate-400">
        Your feedback goes straight to {businessName}.
      </p>
    </div>
  );
}
