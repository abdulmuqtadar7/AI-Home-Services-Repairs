"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type CalTechnician = { id: string; name: string };
export type CalJobOption = {
  id: string;
  title: string;
  customer: string | null;
};

type Appointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  technicianId: string | null;
  jobId: string | null;
  customerId: string | null;
  technician: { id: string; name: string } | null;
  job: { id: string; title: string; status: string } | null;
  customer: { id: string; name: string | null; phone: string | null } | null;
};

const APPT_STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-indigo-100 text-indigo-700",
  CONFIRMED: "bg-sky-100 text-sky-700",
  RESCHEDULED: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  NO_SHOW: "bg-slate-200 text-slate-600",
};

const STATUS_OPTIONS = [
  "SCHEDULED",
  "CONFIRMED",
  "RESCHEDULED",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
];

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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  let h = d.getUTCHours();
  const min = pad(d.getUTCMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

function dateInput(iso: string) {
  return iso.slice(0, 10);
}

function timeInput(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// All times are entered and shown in UTC to stay consistent with the rest of
// the app (AI bookings store UTC instants).
function toIsoUtc(date: string, time: string) {
  return `${date}T${time}:00Z`;
}

type FormState = {
  techId: string;
  jobId: string;
  date: string;
  start: string;
  end: string;
};

function emptyForm(date: string): FormState {
  return { techId: "", jobId: "", date, start: "09:00", end: "10:00" };
}

export function CalendarView({
  month,
  technicians,
  jobs,
  canManage,
}: {
  month: string;
  technicians: CalTechnician[];
  jobs: CalJobOption[];
  canManage: boolean;
}) {
  const [year, mon] = month.split("-").map(Number);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [techFilter, setTechFilter] = useState("");

  // Create form.
  const [form, setForm] = useState<FormState>(() => emptyForm(`${month}-01`));
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Inline edit (reschedule / reassign / status).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState & { status: string }>({
    techId: "",
    jobId: "",
    date: "",
    start: "",
    end: "",
    status: "SCHEDULED",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fromIso = useMemo(
    () => new Date(Date.UTC(year, mon - 1, 1)).toISOString(),
    [year, mon],
  );
  const toIso = useMemo(
    () => new Date(Date.UTC(year, mon, 1)).toISOString(),
    [year, mon],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams({ from: fromIso, to: toIso });
    if (techFilter) params.set("technicianId", techFilter);
    try {
      const res = await fetch(`/api/appointments?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || "Could not load appointments");
        setAppointments([]);
      } else {
        setAppointments(data.appointments ?? []);
      }
    } catch {
      setLoadError("Network error while loading appointments");
    }
    setLoading(false);
  }, [fromIso, toIso, techFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Group appointments by their UTC calendar day (YYYY-MM-DD).
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const day = a.startAt.slice(0, 10);
      const list = map.get(day);
      if (list) list.push(a);
      else map.set(day, [a]);
    }
    for (const list of map.values()) {
      list.sort((x, y) => x.startAt.localeCompare(y.startAt));
    }
    return map;
  }, [appointments]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const out: Array<{ day: number; date: string } | null> = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ day: d, date: `${month}-${pad(d)}` });
    }
    return out;
  }, [year, mon, month]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const thisMonth = `${new Date().getUTCFullYear()}-${pad(
    new Date().getUTCMonth() + 1,
  )}`;
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const selectedAppts = selected ? (byDay.get(selected) ?? []) : [];

  function selectDay(date: string) {
    const isSame = date === selected;
    setSelected(isSame ? null : date);
    setEditingId(null);
    setFormError(null);
    if (!isSame) setForm(emptyForm(date));
  }

  function techName(id: string | null) {
    if (!id) return "Unassigned";
    return technicians.find((t) => t.id === id)?.name ?? "Unassigned";
  }

  async function createAppointment() {
    setFormError(null);
    if (!form.date || !form.start || !form.end) {
      setFormError("Date, start and end time are required");
      return;
    }
    if (form.end <= form.start) {
      setFormError("End time must be after start time");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId: form.techId || null,
          jobId: form.jobId || null,
          startAt: toIsoUtc(form.date, form.start),
          endAt: toIsoUtc(form.date, form.end),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setFormError(
          data.error || "That technician is already booked during this time",
        );
        return;
      }
      if (!res.ok) {
        setFormError(data.error || "Could not create the appointment");
        return;
      }
      setForm(emptyForm(form.date));
      await load();
    } catch {
      setFormError("Network error while creating the appointment");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(a: Appointment) {
    setEditingId(a.id);
    setEditError(null);
    setEditForm({
      techId: a.technicianId ?? "",
      jobId: a.jobId ?? "",
      date: dateInput(a.startAt),
      start: timeInput(a.startAt),
      end: timeInput(a.endAt),
      status: a.status,
    });
  }

  async function saveEdit(id: string) {
    setEditError(null);
    if (!editForm.date || !editForm.start || !editForm.end) {
      setEditError("Date, start and end time are required");
      return;
    }
    if (editForm.end <= editForm.start) {
      setEditError("End time must be after start time");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId: editForm.techId || null,
          startAt: toIsoUtc(editForm.date, editForm.start),
          endAt: toIsoUtc(editForm.date, editForm.end),
          status: editForm.status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setEditError(
          data.error || "That technician is already booked during this time",
        );
        return;
      }
      if (!res.ok) {
        setEditError(data.error || "Could not update the appointment");
        return;
      }
      setEditingId(null);
      await load();
    } catch {
      setEditError("Network error while updating the appointment");
    } finally {
      setSavingEdit(false);
    }
  }

  async function cancelAppointment(id: string) {
    if (!window.confirm("Cancel this appointment? It will free up the slot.")) {
      return;
    }
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not cancel the appointment");
        return;
      }
      await load();
    } catch {
      alert("Network error while cancelling the appointment");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Appointments for {MONTH_NAMES[mon - 1]} {year}
            {loading ? " - loading..." : ""} (times shown in UTC)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            <option value="">All technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Link
            href={`/calendar?month=${prev}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Prev
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
            Next
          </Link>
        </div>
      </div>

      {loadError && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {loadError}
        </p>
      )}

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
          const dayAppts = byDay.get(cell.date) ?? [];
          const isToday = cell.date === todayIso;
          const isSelected = cell.date === selected;
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => selectDay(cell.date)}
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
                {dayAppts.length > 0 && (
                  <span className="text-[10px] font-medium text-slate-400">
                    {dayAppts.length}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {dayAppts.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      APPT_STATUS_STYLES[a.status] ??
                      "bg-slate-100 text-slate-700"
                    }`}
                    title={`${techName(a.technicianId)} - ${a.job?.title ?? a.customer?.name ?? "Appointment"}`}
                  >
                    {timeLabel(a.startAt)} {techName(a.technicianId)}
                  </div>
                ))}
                {dayAppts.length > 3 && (
                  <div className="px-1 text-[10px] text-slate-400">
                    +{dayAppts.length - 3} more
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

          {selectedAppts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No appointments on this day.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {selectedAppts.map((a) => (
                <li key={a.id} className="py-3">
                  {editingId === a.id ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={editForm.date}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, date: e.target.value }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                        <input
                          type="time"
                          value={editForm.start}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              start: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                        <span className="text-slate-400">to</span>
                        <input
                          type="time"
                          value={editForm.end}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, end: e.target.value }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={editForm.techId}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              techId: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="">Unassigned</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editForm.status}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              status: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </div>
                      {editError && (
                        <p className="text-sm text-rose-600">{editError}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingEdit}
                          onClick={() => saveEdit(a.id)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {savingEdit ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Cancel edit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">
                          {timeLabel(a.startAt)} - {timeLabel(a.endAt)}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {techName(a.technicianId)}
                          {a.job ? ` - ${a.job.title}` : ""}
                          {a.customer?.name ? ` - ${a.customer.name}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            APPT_STATUS_STYLES[a.status] ??
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {statusLabel(a.status)}
                        </span>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(a)}
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                            >
                              Edit
                            </button>
                            {a.status !== "CANCELLED" && (
                              <button
                                type="button"
                                onClick={() => cancelAppointment(a.id)}
                                className="text-sm font-medium text-rose-600 hover:text-rose-500"
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-700">
                New appointment
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="time"
                  value={form.start}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, start: e.target.value }))
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="time"
                  value={form.end}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, end: e.target.value }))
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={form.techId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, techId: e.target.value }))
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={form.jobId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, jobId: e.target.value }))
                  }
                  className="max-w-xs rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">No linked job</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                      {j.customer ? ` - ${j.customer}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={creating}
                  onClick={createAppointment}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {creating ? "Adding..." : "Add appointment"}
                </button>
              </div>
              {formError && (
                <p className="mt-2 text-sm text-rose-600">{formError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && appointments.length === 0 && (
        <p className="mt-4 text-center text-sm text-slate-400">
          No appointments this month.
          {canManage ? " Pick a day to schedule one." : ""}
        </p>
      )}
    </div>
  );
}
