"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type JobInput = {
  id?: string;
  title: string;
  customerId: string;
  serviceId: string;
  technicianId: string;
  problem: string;
  address: string;
  zipCode: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "EMERGENCY";
  status:
    | "NEW_LEAD"
    | "QUALIFIED"
    | "ESTIMATE_REQUESTED"
    | "BOOKED"
    | "DISPATCHED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "PAID"
    | "REVIEW_REQUESTED"
    | "LOST_CANCELLED";
  customerType: "RESIDENTIAL" | "COMMERCIAL";
  scheduledAt: string;
  amountCharged: string;
  notes: string;
};

type Option = { id: string; name: string };
type Tech = { id: string; name: string; skills: string[] };

type NewCustomer = {
  name: string;
  phone: string;
  email: string;
  address: string;
  zipCode: string;
};

const STATUSES: ReadonlyArray<readonly [JobInput["status"], string]> = [
  ["NEW_LEAD", "New lead"],
  ["QUALIFIED", "Qualified"],
  ["ESTIMATE_REQUESTED", "Estimate requested"],
  ["BOOKED", "Booked"],
  ["DISPATCHED", "Dispatched"],
  ["IN_PROGRESS", "In progress"],
  ["COMPLETED", "Completed"],
  ["PAID", "Paid"],
  ["REVIEW_REQUESTED", "Review requested"],
  ["LOST_CANCELLED", "Lost / cancelled"],
];
const URGENCIES: ReadonlyArray<readonly [JobInput["urgency"], string]> = [
  ["LOW", "Low"],
  ["NORMAL", "Normal"],
  ["HIGH", "High"],
  ["EMERGENCY", "Emergency"],
];

const NEW_CUSTOMER = "__NEW__";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";

export function JobForm({
  initial,
  customers,
  technicians,
  services,
}: {
  initial?: Partial<JobInput>;
  customers: Option[];
  technicians: Tech[];
  services: Option[];
}) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState<JobInput>({
    title: initial?.title ?? "",
    customerId: initial?.customerId ?? "",
    serviceId: initial?.serviceId ?? "",
    technicianId: initial?.technicianId ?? "",
    problem: initial?.problem ?? "",
    address: initial?.address ?? "",
    zipCode: initial?.zipCode ?? "",
    urgency: initial?.urgency ?? "NORMAL",
    status: initial?.status ?? "NEW_LEAD",
    customerType: initial?.customerType ?? "RESIDENTIAL",
    scheduledAt: initial?.scheduledAt ?? "",
    amountCharged: initial?.amountCharged ?? "",
    notes: initial?.notes ?? "",
  });
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>({
    name: "",
    phone: "",
    email: "",
    address: "",
    zipCode: "",
  });
  const [skill, setSkill] = useState("ANY");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSkills = useMemo(() => {
    const set = new Set<string>();
    for (const t of technicians) for (const s of t.skills) set.add(s);
    return Array.from(set).sort();
  }, [technicians]);

  const techOptions = useMemo(() => {
    const base =
      skill === "ANY"
        ? technicians
        : technicians.filter((t) => t.skills.includes(skill));
    if (form.technicianId && !base.some((t) => t.id === form.technicianId)) {
      const current = technicians.find((t) => t.id === form.technicianId);
      if (current) return [current, ...base];
    }
    return base;
  }, [technicians, skill, form.technicianId]);

  function set<K extends keyof JobInput>(key: K, value: JobInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setNC<K extends keyof NewCustomer>(key: K, value: NewCustomer[K]) {
    setNewCustomer((c) => ({ ...c, [key]: value }));
  }

  function onCustomerSelect(value: string) {
    if (value === NEW_CUSTOMER) {
      setAddingCustomer(true);
      set("customerId", "");
    } else {
      setAddingCustomer(false);
      set("customerId", value);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let customerId = form.customerId;

    if (addingCustomer) {
      if (!newCustomer.name.trim()) {
        setSaving(false);
        setError("New customer needs a name.");
        return;
      }
      const cRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email,
          address: newCustomer.address,
          zipCode: newCustomer.zipCode,
          type: form.customerType,
        }),
      });
      const cData = await cRes.json().catch(() => ({}));
      if (!cRes.ok) {
        setSaving(false);
        setError(cData.error ?? "Could not create customer");
        return;
      }
      customerId = cData.customer?.id ?? "";
    }

    const url = editing ? `/api/jobs/${initial!.id}` : "/api/jobs";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        customerId,
        amountCharged: form.amountCharged === "" ? null : form.amountCharged,
        scheduledAt: form.scheduledAt === "" ? null : form.scheduledAt,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save job");
      return;
    }
    router.push("/jobs");
    router.refresh();
  }

  async function onDelete() {
    if (!editing) return;
    if (!confirm("Delete this job? This cannot be undone.")) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/jobs/${initial!.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleting(false);
      setError(data.error ?? "Could not delete job");
      return;
    }
    router.push("/jobs");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className={labelCls}>Job title</label>
        <input
          required
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={inputCls}
          placeholder="e.g. Water heater leaking"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Customer</label>
          <select
            value={addingCustomer ? NEW_CUSTOMER : form.customerId}
            onChange={(e) => onCustomerSelect(e.target.value)}
            className={inputCls}
          >
            <option value="">— None —</option>
            <option value={NEW_CUSTOMER}>+ Add new customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Service</label>
          <select
            value={form.serviceId}
            onChange={(e) => set("serviceId", e.target.value)}
            className={inputCls}
          >
            <option value="">— None —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {addingCustomer && (
        <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              New customer details
            </p>
            <button
              type="button"
              onClick={() => {
                setAddingCustomer(false);
                set("customerId", "");
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
          <div>
            <label className={labelCls}>Name</label>
            <input
              value={newCustomer.name}
              onChange={(e) => setNC("name", e.target.value)}
              className={inputCls}
              placeholder="Jordan Smith"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone</label>
              <input
                value={newCustomer.phone}
                onChange={(e) => setNC("phone", e.target.value)}
                className={inputCls}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNC("email", e.target.value)}
                className={inputCls}
                placeholder="customer@email.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Address</label>
              <input
                value={newCustomer.address}
                onChange={(e) => setNC("address", e.target.value)}
                className={inputCls}
                placeholder="123 Main St"
              />
            </div>
            <div>
              <label className={labelCls}>ZIP code</label>
              <input
                value={newCustomer.zipCode}
                onChange={(e) => setNC("zipCode", e.target.value)}
                className={inputCls}
                placeholder="90210"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            This customer will be saved to your Customers list when you create
            the job.
          </p>
        </div>
      )}

      <div>
        <label className={labelCls}>Problem / description</label>
        <textarea
          value={form.problem}
          onChange={(e) => set("problem", e.target.value)}
          className={inputCls + " h-24 resize-none"}
          placeholder="What does the customer need?"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Urgency</label>
          <select
            value={form.urgency}
            onChange={(e) =>
              set("urgency", e.target.value as JobInput["urgency"])
            }
            className={inputCls}
          >
            {URGENCIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select
            value={form.status}
            onChange={(e) =>
              set("status", e.target.value as JobInput["status"])
            }
            className={inputCls}
          >
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Customer type</label>
          <select
            value={form.customerType}
            onChange={(e) =>
              set("customerType", e.target.value as JobInput["customerType"])
            }
            className={inputCls}
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Scheduled date / time</label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => set("scheduledAt", e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Skill needed</label>
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className={inputCls}
          >
            <option value="ANY">Any skill</option>
            {allSkills.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Assign technician</label>
          <select
            value={form.technicianId}
            onChange={(e) => set("technicianId", e.target.value)}
            className={inputCls}
          >
            <option value="">— Unassigned —</option>
            {techOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.skills.length ? ` (${t.skills.join(", ")})` : ""}
              </option>
            ))}
          </select>
          {skill !== "ANY" && techOptions.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              No technicians with that skill.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className={labelCls}>Amount charged ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.amountCharged}
          onChange={(e) => set("amountCharged", e.target.value)}
          className={inputCls}
          placeholder="0.00"
        />
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className={inputCls + " h-20 resize-none"}
          placeholder="Internal notes…"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        {editing ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : editing ? "Save changes" : "Create job"}
        </button>
      </div>
    </form>
  );
}
