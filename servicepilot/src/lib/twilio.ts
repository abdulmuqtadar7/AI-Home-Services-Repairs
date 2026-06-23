// src/lib/twilio.ts
// Twilio helpers: TwiML builders (stateless) + SMS sending (stateful).
//
// Multi-tenant model:
// - Each business can configure its own Twilio Account SID / Auth Token / Phone
//   Number via Settings. The auth token is encrypted at rest (see crypto.ts +
//   integrations.ts).
// - If a business hasn't configured its own creds, we fall back to the
//   process.env.TWILIO_* values. This keeps dev/super-admin mode working
//   without forcing every tenant to set up Twilio.
// - isTwilioConfigured() is synchronous and env-only (legacy check).
// - isTwilioConfiguredForBusiness(businessId) is async and tenant-aware.

import { getTwilioCredsForBusiness } from "@/lib/integrations";

const ENV_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const ENV_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const ENV_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";

const VOICE_OPTS = 'language="en-US"';

type TwilioCreds = {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
};

// Resolve effective Twilio creds for a business: tenant creds if configured,
// otherwise the env fallback. Returns null if neither is fully present.
async function resolveCreds(
  businessId?: string,
): Promise<TwilioCreds | null> {
  if (businessId) {
    const tenant = await getTwilioCredsForBusiness(businessId);
    if (tenant) return tenant;
  }
  if (ENV_ACCOUNT_SID && ENV_AUTH_TOKEN && ENV_PHONE_NUMBER) {
    return {
      accountSid: ENV_ACCOUNT_SID,
      authToken: ENV_AUTH_TOKEN,
      phoneNumber: ENV_PHONE_NUMBER,
    };
  }
  return null;
}

// Legacy synchronous check: env-only. Kept for callers that need a fast
// truthiness check without awaiting (e.g. notification builders that don't
// actually send, just flag whether SMS would have been delivered).
export function isTwilioConfigured(): boolean {
  return Boolean(ENV_ACCOUNT_SID && ENV_AUTH_TOKEN && ENV_PHONE_NUMBER);
}

// Tenant-aware check: true if this business can send SMS (either via its own
// configured Twilio account or via the env fallback).
export async function isTwilioConfiguredForBusiness(
  businessId?: string,
): Promise<boolean> {
  return (await resolveCreds(businessId)) !== null;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sayTag(text: string): string {
  return "<Say " + VOICE_OPTS + ">" + escapeXml(text) + "</Say>";
}

function gather(action: string, prompt: string): string {
  return (
    '<Gather input="speech" action="' +
    escapeXml(action) +
    '" method="POST" speechTimeout="auto" language="en-US">' +
    sayTag(prompt) +
    "</Gather>"
  );
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

/** Optional greeting, then a speech Gather, with a graceful fallback if silent. */
export function gatherTwiml(opts: {
  prompt: string;
  action: string;
  greeting?: string;
}): string {
  return (
    XML_HEADER +
    "<Response>" +
    (opts.greeting ? sayTag(opts.greeting) : "") +
    gather(opts.action, opts.prompt) +
    sayTag("Sorry, I didn't catch that. Please call again. Goodbye.") +
    "</Response>"
  );
}

/** Speak a reply, then Gather the next speech turn. */
export function sayThenGatherTwiml(opts: {
  say: string;
  prompt: string;
  action: string;
}): string {
  return (
    XML_HEADER +
    "<Response>" +
    sayTag(opts.say) +
    gather(opts.action, opts.prompt) +
    sayTag("Thank you for calling. Goodbye.") +
    "</Response>"
  );
}

/** Speak a final message and end the call. */
export function sayHangupTwiml(message: string): string {
  return (
    XML_HEADER + "<Response>" + sayTag(message) + "<Hangup/>" + "</Response>"
  );
}

/**
 * Send an SMS via the Twilio REST API (no SDK). Returns true on success.
 *
 * If opts.businessId is provided, uses that business's configured Twilio creds
 * (falling back to env if not configured). If omitted, uses env creds only
 * (legacy behavior — callers should migrate to pass businessId).
 */
export async function sendSms(
  to: string,
  body: string,
  opts?: { businessId?: string },
): Promise<boolean> {
  const creds = await resolveCreds(opts?.businessId);
  if (!creds) return false;
  try {
    const url =
      "https://api.twilio.com/2010-04-01/Accounts/" +
      creds.accountSid +
      "/Messages.json";
    const params = new URLSearchParams();
    params.set("To", to);
    params.set("From", creds.phoneNumber);
    params.set("Body", body);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(creds.accountSid + ":" + creds.authToken).toString(
            "base64",
          ),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
