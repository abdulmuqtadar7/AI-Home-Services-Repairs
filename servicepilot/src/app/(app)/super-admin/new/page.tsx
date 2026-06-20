"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  NICHE_ORDER,
  NICHE_LABELS,
  SERVICE_CATALOG,
  type ServiceNiche,
} from "@/lib/serviceCatalog";

const TONES = ["friendly", "professional", "casual", "empathetic"];

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

type CustomService = { niche: ServiceNiche; name: string };

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={inputCls}
      />
    </label>
  );
}

export default function RegisterBusinessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Required
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  // Trades + service catalog
  const [trades, setTrades] = useState<ServiceNiche[]>([]);
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [customInput, setCustomInput] = useState<Record<string, string>>({});

  // Optional business profile
  const [phone, setPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [diagnosticFee, setDiagnosticFee] = useState("");
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [googleReviewLink, setGoogleReviewLink] = useState("");

  // Optional AI persona
  const [personaName, setPersonaName] = useState("");
  const [tone, setTone] = useState("friendly");
  const [greeting, setGreeting] = useState("");

  const [markComplete, setMarkComplete] = useState(false);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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

    setLoading(true);
    const res = await fetch("/api/super-admin/create-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        ownerName,
        ownerEmail,
        ownerPassword,
        trades,
        niche: trades[0],
        services,
        phone: phone || undefined,
        businessEmail: businessEmail || undefined,
        website: website || undefined,
        diagnosticFee: diagnosticFee ? Number(diagnosticFee) : undefined,
        emergencyAvailable,
        googleReviewLink: googleReviewLink || undefined,
        personaName: personaName || undefined,
        tone: tone || undefined,
        greeting: greeting || undefined,
        markComplete,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not create business");
      return;
    }
    router.push("/super-admin");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Link
        href="/super-admin"
        className="text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Back to Platform Admin
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
        Register a business
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Creates a new client workspace and its owner login. You stay signed in
        as the platform admin.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Account
          </h2>
          <Field
            label="Business name"
            value={businessName}
            onChange={setBusinessName}
            placeholder="ALLFIX Home Repairs"
            required
          />
          <Field
            label="Owner name"
            value={ownerName}
            onChange={setOwnerName}
            placeholder="Jordan Lee"
            required
          />
          <Field
            label="Owner email"
            type="email"
            value={ownerEmail}
            onChange={setOwnerEmail}
            placeholder="owner@business.com"
            required
          />
          <Field
            label="Temporary password"
            type="password"
            value={ownerPassword}
            onChange={setOwnerPassword}
            placeholder="At least 8 characters"
            required
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Business profile (optional)
          </h2>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Trades / business types{" "}
              <span className="font-normal text-slate-400">
                (select all that apply)
              </span>
            </span>
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
                    <span className="mr-2">{on ? "✓" : "+"}</span>
                    {NICHE_LABELS[n]}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {trades.length === 0
                ? "Leave empty to default to General repair with no preset services."
                : `${selectedServiceCount} service${selectedServiceCount === 1 ? "" : "s"} will be added.`}
            </p>
          </div>
          <Field
            label="Business phone"
            value={phone}
            onChange={setPhone}
            placeholder="(555) 123-4567"
          />
          <Field
            label="Business email"
            value={businessEmail}
            onChange={setBusinessEmail}
            placeholder="hello@business.com"
          />
          <Field
            label="Website"
            value={website}
            onChange={setWebsite}
            placeholder="https://business.com"
          />
          <Field
            label="Diagnostic / call-out fee"
            type="number"
            value={diagnosticFee}
            onChange={setDiagnosticFee}
            placeholder="79"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emergencyAvailable}
              onChange={(e) => setEmergencyAvailable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">
              Offers emergency / 24-7 service
            </span>
          </label>
          <Field
            label="Google review link"
            value={googleReviewLink}
            onChange={setGoogleReviewLink}
            placeholder="https://g.page/r/..."
          />
        </section>

        {trades.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Services
            </h2>
            <p className="text-sm text-slate-500">
              Preselected from each trade's catalog. Uncheck to remove, or add
              your own. {selectedServiceCount} selected.
            </p>
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
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            AI assistant (optional)
          </h2>
          <Field
            label="Assistant name"
            value={personaName}
            onChange={setPersonaName}
            placeholder="Alex"
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Tone
            </span>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className={inputCls}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Greeting
            </span>
            <textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={3}
              placeholder="Hi! Thanks for reaching out. How can we help today?"
              className={inputCls}
            />
          </label>
        </section>

        <label className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-3">
          <input
            type="checkbox"
            checked={markComplete}
            onChange={(e) => setMarkComplete(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">
            Mark setup as complete — the owner skips the onboarding wizard and
            goes straight to the dashboard. Leave unchecked to let them finish
            onboarding on first login.
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create business"}
        </button>
      </form>
    </div>
  );
}
