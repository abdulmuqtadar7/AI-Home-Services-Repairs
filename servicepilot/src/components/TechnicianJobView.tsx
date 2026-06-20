"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  "NEW_LEAD",
  "QUALIFIED",
  "ESTIMATE_REQUESTED",
  "BOOKED",
  "DISPATCHED",
  "IN_PROGRESS",
  "COMPLETED",
  "PAID",
  "REVIEW_REQUESTED",
  "LOST_CANCELLED",
] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABELS: Record<Status, string> = {
  NEW_LEAD: "New lead",
  QUALIFIED: "Qualified",
  ESTIMATE_REQUESTED: "Estimate requested",
  BOOKED: "Booked",
  DISPATCHED: "Dispatched",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  PAID: "Paid",
  REVIEW_REQUESTED: "Review requested",
  LOST_CANCELLED: "Lost / cancelled",
};

export type TechJob = {
  id: string;
  title: string;
  status: Status;
  urgency: string;
  customerName: string | null;
  serviceName: string | null;
  technicianName: string | null;
  problem: string | null;
  address: string | null;
  zipCode: string | null;
  scheduledAt: string | null;
  amountCharged: number | null;
  customerType: string;
  notes: string | null;
};

const cardCls = "rounded-xl border border-slate-200 bg-white p-5";
const labelCls = "text-xs font-medium uppercase tracking-wide text-slate-400";

function fmtDate(iso: string | null): string {
  if (!iso) return "Not scheduled";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not scheduled";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  );
}

export function TechnicianJobView({ job }: { job: TechJob }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(job.status);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  const dirty = status !== job.status;

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg({ type: "err", text: data.error || "Could not update status" });
      return;
    }
    setMsg({ type: "ok", text: "Status updated" });
    router.refresh();
  }

  const addressLine =
    [job.address, job.zipCode].filter(Boolean).join(", ") || "\u2014";

  return (
    <div className="space-y-6">
      <div className={cardCls}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer" value={job.customerName ?? "\u2014"} />
          <Field label="Service" value={job.serviceName ?? "\u2014"} />
          <Field label="Scheduled" value={fmtDate(job.scheduledAt)} />
          <Field label="Urgency" value={job.urgency} />
          <Field label="Customer type" value={job.customerType} />
          <Field label="Assigned to" value={job.technicianName ?? "\u2014"} />
        </div>
      </div>

      <div className={cardCls}>
        <p className={labelCls}>Address</p>
        <p className="mt-1 text-sm text-slate-800">{addressLine}</p>
      </div>

      <div className={cardCls}>
        <p className={labelCls}>Problem</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
          {job.problem || "\u2014"}
        </p>
      </div>

      {job.notes ? (
        <div className={cardCls}>
          <p className={labelCls}>Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
            {job.notes}
          </p>
        </div>
      ) : null}

      <div className={cardCls}>
        <p className={labelCls}>Status</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving\u2026" : "Update status"}
          </button>
          {msg ? (
            <span
              className={
                msg.type === "ok"
                  ? "text-sm text-green-600"
                  : "text-sm text-red-600"
              }
            >
              {msg.text}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          You can update the status of jobs assigned to you. Other details are
          read-only.
        </p>
      </div>
    </div>
  );
}
