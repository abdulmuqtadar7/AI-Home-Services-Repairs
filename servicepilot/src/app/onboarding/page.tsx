"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NICHES: ReadonlyArray<readonly [string, string]> = [
  ["PLUMBING", "Plumbing"],
  ["HVAC", "HVAC"],
  ["ELECTRICAL", "Electrical"],
  ["ROOFING", "Roofing"],
  ["PEST_CONTROL", "Pest control"],
  ["CLEANING", "Cleaning"],
  ["APPLIANCE_REPAIR", "Appliance repair"],
  ["HANDYMAN", "Handyman"],
  ["GENERAL_REPAIR", "General repair"],
  ["OTHER", "Other"],
];

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";
const STEPS = ["Business", "Service area", "AI assistant"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    niche: "PLUMBING",
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

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        diagnosticFee: form.diagnosticFee === "" ? null : form.diagnosticFee,
        serviceAreaZips: form.serviceAreaZips
          .split(/[\s,]+/)
          .map((z) => z.trim())
          .filter(Boolean),
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
                <label className={labelCls}>Industry</label>
                <select
                  value={form.niche}
                  onChange={(e) => set("niche", e.target.value)}
                  className={inputCls}
                >
                  {NICHES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
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

          {step === 2 && (
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
                onClick={() =>
                  setStep((s) => Math.min(STEPS.length - 1, s + 1))
                }
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
