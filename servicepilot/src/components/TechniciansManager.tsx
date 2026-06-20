"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type LinkableUser = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  DISPATCHER: "Dispatcher",
  TECHNICIAN: "Technician",
};
export type TechUser = { id: string; name: string; email: string } | null;
export type TechRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  skills: string[];
  active: boolean;
  jobCount: number;
  user: TechUser;
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  skills: string;
  active: boolean;
  userId: string;
};

const EMPTY: FormState = {
  name: "",
  phone: "",
  email: "",
  skills: "",
  active: true,
  userId: "",
};

export function TechniciansManager({
  initialRows,
  linkableUsers,
}: {
  initialRows: TechRow[];
  linkableUsers: LinkableUser[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "new" | string>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  const editing = useMemo(
    () =>
      mode && mode !== "new" ? initialRows.find((r) => r.id === mode) : null,
    [mode, initialRows],
  );

  // Options for the link dropdown: unlinked staff + the row's own linked user.
  const linkOptions = useMemo(() => {
    const opts = [...linkableUsers];
    if (editing?.user && !opts.some((o) => o.id === editing.user!.id)) {
      opts.unshift(editing.user);
    }
    return opts;
  }, [linkableUsers, editing]);

  function openNew() {
    setForm(EMPTY);
    setMode("new");
    setMsg(null);
  }

  function openEdit(t: TechRow) {
    setForm({
      name: t.name,
      phone: t.phone ?? "",
      email: t.email ?? "",
      skills: t.skills.join(", "),
      active: t.active,
      userId: t.user?.id ?? "",
    });
    setMode(t.id);
    setMsg(null);
  }

  function close() {
    setMode(null);
    setForm(EMPTY);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setMsg({ type: "err", text: "Name is required" });
      return;
    }
    setBusy(true);
    setMsg(null);

    const skills = form.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      skills,
      active: form.active,
      userId: form.userId || null,
    };

    const isNew = mode === "new";
    const res = await fetch(
      isNew ? "/api/technicians" : `/api/technicians/${mode}`,
      {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setMsg({ type: "err", text: data.error ?? "Something went wrong" });
      return;
    }
    close();
    setMsg({ type: "ok", text: isNew ? "Technician added" : "Changes saved" });
    router.refresh();
  }

  async function toggleActive(t: TechRow) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/technicians/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: "err", text: data.error ?? "Could not update" });
    }
  }

  async function remove(t: TechRow) {
    if (
      !window.confirm(
        `Delete ${t.name}? Any jobs assigned to them will be left unassigned.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/technicians/${t.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setMsg({ type: "ok", text: "Technician deleted" });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: "err", text: data.error ?? "Could not delete" });
    }
  }

  const showForm = mode !== null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Technicians</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your field staff and link them to a login so they only see
            their own assigned jobs.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openNew}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add technician
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-medium text-slate-900">
            {mode === "new" ? "New technician" : `Edit ${editing?.name ?? ""}`}
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Jane Smith"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="(555) 123-4567"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="jane@example.com"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Linked login
              </span>
              <select
                value={form.userId}
                onChange={(e) => set("userId", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Not linked</option>
                {linkOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.role ? ` — ${ROLE_LABELS[u.role] ?? u.role}` : ""} (
                    {u.email})
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-400">
                Only technician-role logins are limited to their own jobs.
              </span>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-700">Skills</span>
            <input
              value={form.skills}
              onChange={(e) => set("skills", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Drain cleaning, Water heaters, Leak detection"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Separate skills with commas.
            </span>
          </label>

          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">
              Active (available for job assignment)
            </span>
          </label>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "Saving..." : mode === "new" ? "Add technician" : "Save"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {initialRows.length === 0 && !showForm && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">
              No technicians yet. Add your first one to start assigning jobs.
            </p>
          </div>
        )}

        {initialRows.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900">{t.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {[t.phone, t.email].filter(Boolean).join(" \u00b7 ") ||
                    "No contact details"}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {t.user
                    ? `Linked to ${t.user.name} (${t.user.email})`
                    : "Not linked to a login"}
                  {" \u00b7 "}
                  {t.jobCount} job{t.jobCount === 1 ? "" : "s"}
                </div>
                {t.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => openEdit(t)}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(t)}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {t.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => remove(t)}
                  disabled={busy}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
