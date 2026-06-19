"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  NICHE_ORDER,
  NICHE_LABELS,
  SERVICE_CATALOG,
  type ServiceNiche,
} from "@/lib/serviceCatalog";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";
const STEPS = ["Business", "Services", "Service area", "AI assistant"];

type CustomService = { niche: ServiceNiche; name: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trades, setTrades] = useState<ServiceNiche[]>(["PLUMBING"]);
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [customInput, setCustomInput] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    phone: "",
    email: "",
    website: "",
    diagnosticFee: "",
    emergencyAvailable: false,
    googleReviewLink: "",
    serviceAreaZips: "",
    personaName: "Assistant",
    tone: "friendly",
    greeting: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleTrade(n: ServiceNiche) {
    setTrades((prev) =>
      prev.includes(n) ? prev.filter((t) => t !== n) : [...prev, n],
    );
  }

  function svcKey(niche: string, name: string) {
    return niche + "::" + name;
  }
  function toggleCatalog(niche: ServiceNiche, name: string) {
    const k = svcKey(niche, name);
    setUnchecked((u) => ({ ...u, [k]: !u[k] }));
  }
  function addCustom(niche: ServiceNiche) {
    const name = (customInput[niche] ?? "").trim();
    if (!name) return;
    setCustomServices((c) => [...c, { niche, name }]);
    setCustomInput((ci) => ({ ...ci, [niche]: "" }));
  }
  function removeCustom(idx: number) {
    setCustomServices((c) => c.filter((_, i) => i !== idx));
  }

  const selectedServiceCount = useMemo(() => {
    let n = 0;
    for (const t of trades)
      for (const s of SERVICE_CATALOG[t])
        if (!unchecked[svcKey(t, s.name)]) n++;
    return n + customServices.filter((c) => trades.includes(c.niche)).length;
  }, [trades, unchecked, customServices]);

  function next() {
    if (step === 0 && trades.length === 0) {
      setError("Pick at least one business type.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function submit() {
    if (trades.length === 0) {
      setStep(0);
      setError("Pick at least one business type.");
      return;
    }
    setSaving(true);
    setError(null);

    const services: {
      name: string;
      niche: ServiceNiche;
      basePrice: number | null;
      durationMin: number;
    }[] = [];
    for (const t of trades) {
      for (const s of SERVICE_CATALOG[t]) {
        if (!unchecked[svcKey(t, s.name)])
          services.push({
            name: s.name,
            niche: t,
            basePrice: s.basePrice,
            durationMin: s.durationMin,
          });
      }
    }
    for (const c of customServices) {
      if (trades.includes(c.niche))
        services.push({
          name: c.name,
          niche: c.niche,
          basePrice: null,
          durationMin: 60,
        });
    }

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trades,
        niche: trades[0],
        services,
        phone: form.phone,
        email: form.email,
        website: form.website,
        diagnosticFee: form.diagnosticFee === "" ? null : form.diagnosticFee,
        emergencyAvailable: form.emergencyAvailable,
        googleReviewLink: form.googleReviewLink,
        serviceAreaZips: form.serviceAreaZips
          .split(/[\s,]+/)
          .map((z) => z.trim())
          .filter(Boolean),
        personaName: form.personaName,
        tone: form.tone,
        greeting: form.greeting,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }
    router.push(data.redirect || "/dashboard");
    router.refresh();
  }

  const last = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Set up your workspace
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            A few details so your AI assistant can start working.
          </p>
        </div>

        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={
                  "h-1.5 rounded-full " +
                  (i <= step ? "bg-indigo-600" : "bg-slate-200")
                }
              />
              <p
                className={
                  "mt-1 text-xs " +
                  (i <= step ? "text-indigo-700" : "text-slate-400")
                }
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 0 && (
            <>
              <div>
                <label className={labelCls}>
                  Business type{" "}
                  <span className="font-normal text-slate-400">
                    (select all that apply)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {NICHE_ORDER.map((n) => {
                    const on = trades.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleTrade(n)}
                        className={
                          "rounded-lg border px-3 py-2 text-left text-sm font-medium transition " +
                          (on
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50")
                        }
                      >
                        <span className="mr-2">{on ? "\u2713" : "+"}</span>
                        {NICHE_LABELS[n]}
                      </button>
                    );
                  })}
                </div>
                {trades.length > 1 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Multi-trade business — you'll be able to pick a category
                    when creating each job.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Business phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    className={inputCls}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className={labelCls}>Business email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={inputCls}
                    placeholder="hello@company.com"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                  className={inputCls}
                  placeholder="https://company.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Diagnostic / call-out fee</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.diagnosticFee}
                    onChange={(e) => set("diagnosticFee", e.target.value)}
                    className={inputCls}
                    placeholder="89.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>Google review link</label>
                  <input
                    value={form.googleReviewLink}
                    onChange={(e) => set("googleReviewLink", e.target.value)}
                    className={inputCls}
                    placeholder="https://g.page/..."
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.emergencyAvailable}
                  onChange={(e) => set("emergencyAvailable", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                We offer 24/7 emergency service
              </label>
            </>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-slate-500">
                Pick the services you offer. These power your AI assistant's
                quotes and bookings. {selectedServiceCount} selected.
              </p>
              {trades.length === 0 && (
                <p className="text-sm text-amber-600">
                  Go back and choose at least one business type first.
                </p>
              )}
              {trades.map((t) => (
                <div key={t} className="rounded-xl border border-slate-200 p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-800">
                    {NICHE_LABELS[t]}
                  </p>
                  <div className="space-y-1.5">
                    {SERVICE_CATALOG[t].map((s) => {
                      const checked = !unchecked[svcKey(t, s.name)];
                      return (
                        <label
                          key={s.name}
                          className="flex items-center justify-between gap-2 text-sm text-slate-700"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCatalog(t, s.name)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            {s.name}
                          </span>
                          {s.basePrice != null && (
                            <span className="text-xs text-slate-400">
                              ${s.basePrice}
                            </span>
                          )}
                        </label>
                      );
                    })}
                    {customServices.map((c, i) =>
                      c.niche === t ? (
                        <div
                          key={"c" + i}
                          className="flex items-center justify-between gap-2 text-sm text-slate-700"
                        >
                          <span className="flex items-center gap-2">
                            <span className="inline-block h-4 w-4 rounded border border-indigo-300 bg-indigo-50 text-center text-[10px] leading-4 text-indigo-600">
                              ✓
                            </span>
                            {c.name}
                            <span className="rounded bg-indigo-50 px-1.5 text-[10px] font-medium uppercase text-indigo-500">
                              custom
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCustom(i)}
                            className="text-xs text-slate-400 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null,
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={customInput[t] ?? ""}
                      onChange={(e) =>
                        setCustomInput((ci) => ({ ...ci, [t]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustom(t);
                        }
                      }}
                      className={inputCls}
                      placeholder="Add another service…"
                    />
                    <button
                      type="button"
                      onClick={() => addCustom(t)}
                      className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <label className={labelCls}>Service area ZIP codes</label>
              <textarea
                value={form.serviceAreaZips}
                onChange={(e) => set("serviceAreaZips", e.target.value)}
                className={inputCls + " h-32 resize-none"}
                placeholder="Enter ZIP codes separated by commas or new lines"
              />
              <p className="mt-1 text-xs text-slate-500">
                The AI uses these to confirm whether a caller is in your area.
              </p>
            </div>
          )}

          {step === 3 && (
            <>
              <div>
                <label className={labelCls}>Assistant name</label>
                <input
                  value={form.personaName}
                  onChange={(e) => set("personaName", e.target.value)}
                  className={inputCls}
                  placeholder="Assistant"
                />
              </div>
              <div>
                <label className={labelCls}>Tone</label>
                <select
                  value={form.tone}
                  onChange={(e) => set("tone", e.target.value)}
                  className={inputCls}
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Greeting</label>
                <textarea
                  value={form.greeting}
                  onChange={(e) => set("greeting", e.target.value)}
                  className={inputCls + " h-24 resize-none"}
                  placeholder="Hi! Thanks for reaching out. How can we help today?"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Back
            </button>
            {last ? (
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Finishing…" : "Finish setup"}
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
