"use client";

import { useState } from "react";
import {
  NICHE_LABELS,
  NICHE_ORDER,
  type ServiceNiche,
} from "@/lib/serviceCatalog";

type Service = {
  id: string;
  name: string;
  niche: ServiceNiche | null;
  description: string | null;
  basePrice: number | null;
  durationMin: number;
  active: boolean;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";
const cardCls = "rounded-xl border border-slate-200 bg-white p-5";

function priceToInput(p: number | null): string {
  return p === null ? "" : String(p);
}

export function ServiceCatalog({ initial }: { initial: Service[] }) {
  const [services, setServices] = useState<Service[]>(initial);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [niche, setNiche] = useState<ServiceNiche>(NICHE_ORDER[0]);
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("60");
  const [adding, setAdding] = useState(false);

  function flash(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    window.setTimeout(() => setMsg(null), 3500);
  }

  async function addService() {
    if (!name.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          niche,
          basePrice: price.trim() === "" ? null : price.trim(),
          durationMin: Number(duration) || 60,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash("err", data.error || "Could not add service.");
        return;
      }
      setServices((s) => [...s, data.service]);
      setName("");
      setPrice("");
      setDuration("60");
      flash("ok", "Service added.");
    } catch {
      flash("err", "Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  function patchLocal(id: string, patch: Partial<Service>) {
    setServices((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function saveService(svc: Service) {
    setBusyId(svc.id);
    try {
      const res = await fetch("/api/services/" + svc.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: svc.name.trim(),
          niche: svc.niche,
          basePrice: svc.basePrice,
          durationMin: svc.durationMin,
          active: svc.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash("err", data.error || "Could not save.");
        return;
      }
      patchLocal(svc.id, data.service);
      flash("ok", "Saved.");
    } catch {
      flash("err", "Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(svc: Service) {
    setBusyId(svc.id);
    try {
      const res = await fetch("/api/services/" + svc.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !svc.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash("err", data.error || "Could not update.");
        return;
      }
      patchLocal(svc.id, data.service);
    } catch {
      flash("err", "Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeService(svc: Service) {
    if (!window.confirm('Remove "' + svc.name + '"?')) return;
    setBusyId(svc.id);
    try {
      const res = await fetch("/api/services/" + svc.id, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        flash("err", data.error || "Could not remove.");
        return;
      }
      if (data.archived) {
        patchLocal(svc.id, { active: false });
        flash(
          "ok",
          "This service has booked jobs, so it was archived instead of deleted.",
        );
      } else {
        setServices((s) => s.filter((x) => x.id !== svc.id));
        flash("ok", "Service removed.");
      }
    } catch {
      flash("err", "Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...services].sort((a, b) => {
    const ai = a.niche ? NICHE_ORDER.indexOf(a.niche) : 999;
    const bi = b.niche ? NICHE_ORDER.indexOf(b.niche) : 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={cardCls}>
      <h2 className="text-lg font-semibold text-slate-900">Service catalog</h2>
      <p className="mb-4 text-sm text-slate-500">
        These services and prices guide your AI assistant when it quotes and
        books jobs.
      </p>

      {msg && (
        <div
          className={
            "mb-4 rounded-lg px-3 py-2 text-sm " +
            (msg.type === "ok"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700")
          }
        >
          {msg.text}
        </div>
      )}

      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Service name</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Drain cleaning"
            />
          </div>
          <div>
            <label className={labelCls}>Trade</label>
            <select
              className={inputCls}
              value={niche}
              onChange={(e) => setNiche(e.target.value as ServiceNiche)}
            >
              {NICHE_ORDER.map((n) => (
                <option key={n} value={n}>
                  {NICHE_LABELS[n]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Base price ($)</label>
              <input
                className={inputCls}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelCls}>Minutes</label>
              <input
                className={inputCls}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={addService}
            disabled={adding || !name.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {adding ? "Adding..." : "Add service"}
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400">
          No services yet. Add your first one above.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((svc) => (
            <div
              key={svc.id}
              className={
                "rounded-lg border p-3 " +
                (svc.active
                  ? "border-slate-200 bg-white"
                  : "border-slate-200 bg-slate-50 opacity-70")
              }
            >
              <div className="grid gap-2 sm:grid-cols-12 sm:items-end">
                <div className="sm:col-span-4">
                  <label className={labelCls}>Name</label>
                  <input
                    className={inputCls}
                    value={svc.name}
                    onChange={(e) =>
                      patchLocal(svc.id, { name: e.target.value })
                    }
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelCls}>Trade</label>
                  <select
                    className={inputCls}
                    value={svc.niche ?? "OTHER"}
                    onChange={(e) =>
                      patchLocal(svc.id, {
                        niche: e.target.value as ServiceNiche,
                      })
                    }
                  >
                    {NICHE_ORDER.map((n) => (
                      <option key={n} value={n}>
                        {NICHE_LABELS[n]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Price ($)</label>
                  <input
                    className={inputCls}
                    value={priceToInput(svc.basePrice)}
                    inputMode="decimal"
                    onChange={(e) =>
                      patchLocal(svc.id, {
                        basePrice:
                          e.target.value.trim() === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Minutes</label>
                  <input
                    className={inputCls}
                    value={String(svc.durationMin)}
                    inputMode="numeric"
                    onChange={(e) =>
                      patchLocal(svc.id, {
                        durationMin: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="flex sm:col-span-1 sm:justify-end">
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={svc.active}
                      onChange={() => toggleActive(svc)}
                    />
                    On
                  </label>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => saveService(svc)}
                  disabled={busyId === svc.id || !svc.name.trim()}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => removeService(svc)}
                  disabled={busyId === svc.id}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  Remove
                </button>
                {!svc.active && (
                  <span className="text-xs text-slate-400">Inactive</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
