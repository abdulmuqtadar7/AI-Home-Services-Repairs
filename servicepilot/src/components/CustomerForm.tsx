"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type CustomerInput = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  zipCode: string;
  type: "RESIDENTIAL" | "COMMERCIAL";
  notes: string;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";

export function CustomerForm({
  initial,
}: {
  initial?: Partial<CustomerInput>;
}) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState<CustomerInput>({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
    zipCode: initial?.zipCode ?? "",
    type: initial?.type ?? "RESIDENTIAL",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const url = editing ? `/api/customers/${initial!.id}` : "/api/customers";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save customer");
      return;
    }
    router.push("/customers");
    router.refresh();
  }

  async function onDelete() {
    if (!editing) return;
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/customers/${initial!.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleting(false);
      setError(data.error ?? "Could not delete customer");
      return;
    }
    router.push("/customers");
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
        <label className={labelCls}>Name</label>
        <input
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputCls}
          placeholder="Jordan Smith"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Phone</label>
          <input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={inputCls}
            placeholder="(555) 123-4567"
          />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className={inputCls}
            placeholder="customer@email.com"
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Address</label>
        <input
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          className={inputCls}
          placeholder="123 Main St"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>ZIP code</label>
          <input
            value={form.zipCode}
            onChange={(e) => set("zipCode", e.target.value)}
            className={inputCls}
            placeholder="90210"
          />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select
            value={form.type}
            onChange={(e) =>
              set("type", e.target.value as CustomerInput["type"])
            }
            className={inputCls}
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className={inputCls + " h-24 resize-none"}
          placeholder="Anything useful about this customer…"
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
          {saving ? "Saving…" : editing ? "Save changes" : "Create customer"}
        </button>
      </div>
    </form>
  );
}
