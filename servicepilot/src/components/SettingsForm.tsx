// src/components/SettingsForm.tsx
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
  integration?: {
    twilioAccountSid: string;
    twilioAuthTokenMasked: string;
    twilioAuthTokenSet: boolean;
    twilioPhoneNumber: string;
  } | null;
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

  // Twilio integration state. authToken is intentionally left blank on load —
  // the server returns a masked preview, never the plaintext. An empty field
  // on save means "no change"; a non-empty field means "update".
  const [twilioAccountSid, setTwilioAccountSid] = useState(
    initial.integration?.twilioAccountSid || "",
  );
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState(
    initial.integration?.twilioPhoneNumber || "",
  );
  const [twilioAuthTokenSet, setTwilioAuthTokenSet] = useState(
    initial.integration?.twilioAuthTokenSet || false,
  );
  const [twilioAuthTokenMasked, setTwilioAuthTokenMasked] = useState(
    initial.integration?.twilioAuthTokenMasked || "",
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

    // Only send twilioAuthToken if the user typed something. Empty = no change.
    const body: Record<string, unknown> = {
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
      twilioAccountSid,
      twilioPhoneNumber,
    };
    if (twilioAuthToken !== "") {
      body.twilioAuthToken = twilioAuthToken;
    }

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMsg({ type: "err", text: data.error || "Could not save settings." });
      return;
    }

    // After save, refresh the masked token preview and clear the plaintext
    // input so the user has to retype to change it again.
    if (twilioAuthToken !== "") {
      setTwilioAuthTokenSet(true);
      // The new masked preview isn't returned by PATCH; refetch GET to get it.
      try {
        const r = await fetch("/api/settings");
        const j = await r.json();
        if (j?.integration?.twilioAuthTokenMasked) {
          setTwilioAuthTokenMasked(j.integration.twilioAuthTokenMasked);
        }
      } catch {
        // non-fatal
      }
    }
    setTwilioAuthToken("");
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
              If set, replaces the auto-generated prompt entirely. Use with care.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Booking enabled</label>
              <select
                className={inputCls}
                value={bookingEnabled ? "yes" : "no"}
                onChange={(e) => setBookingEnabled(e.target.value === "yes")}
              >
                <option value="yes">Yes — AI can book visits</option>
                <option value="no">No — AI only qualifies leads</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Collect job photos</label>
              <select
                className={inputCls}
                value={collectPhotos ? "yes" : "no"}
                onChange={(e) => setCollectPhotos(e.target.value === "yes")}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Emergency keywords</label>
            <input
              className={inputCls}
              value={emergencyKeywords}
              onChange={(e) => setEmergencyKeywords(e.target.value)}
              placeholder="burst, flood, gas leak, no heat"
            />
            <p className="mt-1 text-xs text-slate-400">
              Comma-separated. When a customer mentions these, the lead is
              flagged for immediate human follow-up.
            </p>
          </div>
        </div>
      </section>

      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-slate-900">
          Business profile
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Trade categories, contact details, and pricing defaults.
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Trades you work in</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {NICHES.map((n) => (
                <label
                  key={n}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={trades.includes(n)}
                    onChange={() => toggleTrade(n)}
                    className="rounded border-slate-300"
                  />
                  {NICHE_LABELS[n]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Primary trade</label>
            <select
              className={inputCls}
              value={primary}
              onChange={(e) => setPrimary(e.target.value as Niche)}
            >
              {trades.map((n) => (
                <option key={n} value={n}>
                  {NICHE_LABELS[n]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Phone</label>
              <input
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 0100"
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@example.com"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input
              className={inputCls}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Diagnostic fee ($)</label>
              <input
                className={inputCls}
                value={diagnosticFee}
                onChange={(e) => setDiagnosticFee(e.target.value)}
                placeholder="89"
              />
            </div>
            <div>
              <label className={labelCls}>Emergency service</label>
              <select
                className={inputCls}
                value={emergencyAvailable ? "yes" : "no"}
                onChange={(e) =>
                  setEmergencyAvailable(e.target.value === "yes")
                }
              >
                <option value="yes">Yes — available 24/7</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Google review link</label>
            <input
              className={inputCls}
              value={googleReviewLink}
              onChange={(e) => setGoogleReviewLink(e.target.value)}
              placeholder="https://g.page/your-business/review"
            />
          </div>
        </div>
      </section>

      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-slate-900">
          Twilio integration
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Bring your own Twilio account for SMS and voice. The auth token is
          encrypted at rest and never sent back to the browser after saving.
          Leave blank to use the platform default (if configured).
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Twilio Account SID</label>
            <input
              className={inputCls}
              value={twilioAccountSid}
              onChange={(e) => setTwilioAccountSid(e.target.value)}
              placeholder="AC..."
            />
          </div>
          <div>
            <label className={labelCls}>Twilio Auth Token</label>
            <input
              className={inputCls}
              type="password"
              value={twilioAuthToken}
              onChange={(e) => setTwilioAuthToken(e.target.value)}
              placeholder={
                twilioAuthTokenSet
                  ? `Currently set (${twilioAuthTokenMasked}). Type a new value to replace.`
                  : "Enter auth token to set"
              }
              autoComplete="off"
            />
            {twilioAuthTokenSet && twilioAuthToken === "" && (
              <p className="mt-1 text-xs text-slate-400">
                A token is currently saved ({twilioAuthTokenMasked}). Leave this
                field blank to keep it unchanged.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Twilio Phone Number</label>
            <input
              className={inputCls}
              value={twilioPhoneNumber}
              onChange={(e) => setTwilioPhoneNumber(e.target.value)}
              placeholder="+1 555 0100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Must be a Twilio-owned number capable of SMS and voice.
            </p>
          </div>
        </div>
      </section>

      {msg && (
        <div
          className={
            msg.type === "ok"
              ? "rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {msg.text}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}
