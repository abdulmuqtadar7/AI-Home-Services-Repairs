"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const NICHES = [
  { v: "PLUMBING", l: "Plumbing" },
  { v: "HVAC", l: "HVAC" },
  { v: "ELECTRICAL", l: "Electrical" },
  { v: "ROOFING", l: "Roofing" },
  { v: "PEST_CONTROL", l: "Pest control" },
  { v: "CLEANING", l: "Cleaning" },
  { v: "APPLIANCE_REPAIR", l: "Appliance repair" },
  { v: "HANDYMAN", l: "Handyman" },
  { v: "GENERAL_REPAIR", l: "General repair" },
  { v: "OTHER", l: "Other" },
];

const TONES = ["friendly", "professional", "casual", "empathetic"];

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

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

  // Optional business profile
  const [niche, setNiche] = useState("");
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/super-admin/create-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        ownerName,
        ownerEmail,
        ownerPassword,
        niche: niche || undefined,
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
        &#8592; Back to Platform Admin
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
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Trade / niche
            </span>
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className={inputCls}
            >
              <option value="">Use default (General repair)</option>
              {NICHES.map((n) => (
                <option key={n.v} value={n.v}>
                  {n.l}
                </option>
              ))}
            </select>
          </label>
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
            Mark setup as complete &mdash; the owner skips the onboarding wizard
            and goes straight to the dashboard. Leave unchecked to let them
            finish onboarding on first login.
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
