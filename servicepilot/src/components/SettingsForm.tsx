"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const NICHES = [
  "PLUMBING",
  "HVAC",
  "ELECTRICAL",
  "ROOFING",
  "PEST_CONTROL",
  "CLEANING",
  "APPLIANCE_REPAIR",
  "HANDYMAN",
  "GENERAL_REPAIR",
  "OTHER",
] as const;
type Niche = (typeof NICHES)[number];

const NICHE_LABELS: Record<Niche, string> = {
  PLUMBING: "Plumbing",
  HVAC: "HVAC",
  ELECTRICAL: "Electrical",
  ROOFING: "Roofing",
  PEST_CONTROL: "Pest control",
  CLEANING: "Cleaning",
  APPLIANCE_REPAIR: "Appliance repair",
  HANDYMAN: "Handyman",
  GENERAL_REPAIR: "General repair",
  OTHER: "Other",
};

type Initial = {
  business: {
    name: string;
    niche: Niche;
    trades: Niche[];
    phone: string;
    email: string;
    website: string;
    emergencyAvailable: boolean;
    diagnosticFee: number | null;
    googleReviewLink: string;
  };
  ai: {
    personaName: string;
    tone: string;
    greeting: string;
    systemPromptOverride: string;
    bookingEnabled: boolean;
    collectPhotos: boolean;
    emergencyKeywords: string[];
  };
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelCls = "mb-1 block text-sm font-medium text-slate-700";
const cardCls = "rounded-xl border border-slate-200 bg-white p-5";

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [trades, setTrades] = useState<Niche[]>(initial.business.trades);
  const [primary, setPrimary] = useState<Niche>(initial.business.niche);
  const [phone, setPhone] = useState(initial.business.phone);
  const [email, setEmail] = useState(initial.business.email);
  const [website, setWebsite] = useState(initial.business.website);
  const [emergencyAvailable, setEmergencyAvailable] = useState(
    initial.business.emergencyAvailable,
  );
  const [diagnosticFee, setDiagnosticFee] = useState(
    initial.business.diagnosticFee === null
      ? ""
      : String(initial.business.diagnosticFee),
  );
  const [googleReviewLink, setGoogleReviewLink] = useState(
    initial.business.googleReviewLink,
  );

  const [personaName, setPersonaName] = useState(initial.ai.personaName);
  const [tone, setTone] = useState(initial.ai.tone);
  const [greeting, setGreeting] = useState(initial.ai.greeting);
  const [systemPromptOverride, setSystemPromptOverride] = useState(
    initial.ai.systemPromptOverride,
  );
  const [bookingEnabled, setBookingEnabled] = useState(
    initial.ai.bookingEnabled,
  );
  const [collectPhotos, setCollectPhotos] = useState(initial.ai.collectPhotos);
  const [emergencyKeywords, setEmergencyKeywords] = useState(
    initial.ai.emergencyKeywords.join(", "),
  );

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  function toggleTrade(n: Niche) {
    setTrades((prev) =>
      prev.includes(n) ? prev.filter((t) => t !== n) : [...prev, n],
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (trades.length === 0) {
      setMsg({ type: "err", text: "Select at least one trade." });
      return;
    }
    const primaryNiche = trades.includes(primary) ? primary : trades[0];
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trades,
        niche: primaryNiche,
        phone,
        email,
        website,
        diagnosticFee: diagnosticFee === "" ? null : diagnosticFee,
        emergencyAvailable,
        googleReviewLink,
        personaName,
        tone,
        greeting,
        systemPromptOverride,
        bookingEnabled,
        collectPhotos,
        emergencyKeywords: emergencyKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg({ type: "err", text: data.error || "Could not save settings." });
      return;
    }
    setMsg({ type: "ok", text: "Settings saved." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-slate-900">AI Assistant</h2>
        <p className="mb-4 text-sm text-slate-500">
          How your AI receptionist talks to customers.
        </p>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Assistant name</label>
              <input
                className={inputCls}
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                placeholder="Assistant"
              />
            </div>
            <div>
              <label className={labelCls}>Tone</label>
              <select
                className={inputCls}
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Greeting</label>
            <textarea
              className={inputCls}
              rows={2}
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Hi! Thanks for reaching out. How can we help today?"
            />
          </div>
          <div>
            <label className={labelCls}>
              System prompt override (advanced)
            </label>
            <textarea
              className={inputCls}
              rows={4}
              value={systemPromptOverride}
              onChange={(e) => setSystemPromptOverride(e.target.value)}
              placeholder="Leave blank to use the smart default prompt."
            />
            <p className="mt-1 text-xs text-slate-400">
              Replaces the auto-generated instructions. Leave blank unless you
              know what you&apos;re doing.
            </p>
          </div>
          <div>
            <label className={labelCls}>Emergency keywords</label>
            <input
              className={inputCls}
              value={emergencyKeywords}
              onChange={(e) => setEmergencyKeywords(e.target.value)}
              placeholder="flood, gas leak, no heat, burst pipe"
            />
            <p className="mt-1 text-xs text-slate-400">
              Comma-separated. Messages containing these are flagged urgent.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={bookingEnabled}
                onChange={(e) => setBookingEnabled(e.target.checked)}
              />
              Let the AI book appointments
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={collectPhotos}
                onChange={(e) => setCollectPhotos(e.target.checked)}
              />
              Ask customers for photos of the problem
            </label>
          </div>
        </div>
      </section>

      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-slate-900">Trades</h2>
        <p className="mb-4 text-sm text-slate-500">
          The services your business offers. This scopes what the AI will talk
          about.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NICHES.map((n) => (
            <label
              key={n}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={trades.includes(n)}
                onChange={() => toggleTrade(n)}
              />
              {NICHE_LABELS[n]}
            </label>
          ))}
        </div>
        <div className="mt-4 max-w-xs">
          <label className={labelCls}>Primary trade</label>
          <select
            className={inputCls}
            value={primary}
            onChange={(e) => setPrimary(e.target.value as Niche)}
          >
            {(trades.length ? trades : [...NICHES]).map((n) => (
              <option key={n} value={n}>
                {NICHE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-slate-900">
          Business profile
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Contact details and policies shown to customers.
        </p>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Phone</label>
              <input
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@business.com"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Website</label>
              <input
                className={inputCls}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className={labelCls}>Diagnostic / call-out fee ($)</label>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={diagnosticFee}
                onChange={(e) => setDiagnosticFee(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Google review link</label>
            <input
              className={inputCls}
              value={googleReviewLink}
              onChange={(e) => setGoogleReviewLink(e.target.value)}
              placeholder="https://g.page/r/..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={emergencyAvailable}
              onChange={(e) => setEmergencyAvailable(e.target.checked)}
            />
            We offer 24/7 emergency service
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? "Saving\u2026" : "Save changes"}
        </button>
        {msg && (
          <span
            className={
              msg.type === "ok"
                ? "text-sm text-green-600"
                : "text-sm text-red-600"
            }
          >
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
