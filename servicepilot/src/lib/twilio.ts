const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";

const VOICE_OPTS = 'language="en-US"';

export function isTwilioConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN && PHONE_NUMBER);
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

/** Send an SMS via the Twilio REST API (no SDK). Returns true on success. */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!isTwilioConfigured()) return false;
  try {
    const url =
      "https://api.twilio.com/2010-04-01/Accounts/" +
      ACCOUNT_SID +
      "/Messages.json";
    const params = new URLSearchParams();
    params.set("To", to);
    params.set("From", PHONE_NUMBER);
    params.set("Body", body);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(ACCOUNT_SID + ":" + AUTH_TOKEN).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
