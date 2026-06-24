// src/lib/crypto.ts
// AES-256-GCM symmetric encryption for secrets stored at rest
// (Twilio auth tokens, future Stripe keys, Google API keys, etc.).
//
// Wire format: "v1:" + base64(iv(12) + ciphertext + authTag(16))
// The "v1:" prefix lets us evolve the format later and detect plaintext
// legacy values during a transition window.

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = "v1:";

let warnedAboutDevKey = false;

function resolveKey(): Buffer {
  const env = process.env.ENCRYPTION_KEY;
  if (env) {
    // Accept either base64 or hex; validate length after decoding.
    let buf: Buffer;
    try {
      buf = Buffer.from(env, "base64");
      if (buf.length === 32) return buf;
    } catch {
      // fall through to hex attempt
    }
    try {
      buf = Buffer.from(env, "hex");
      if (buf.length === 32) return buf;
    } catch {
      // fall through to error
    }
    throw new Error(
      "ENCRYPTION_KEY must decode to 32 bytes (base64 or hex). Got " +
        env.length +
        " chars.",
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_KEY is required in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }

  // Dev fallback: deterministic so encrypted values round-trip within a session.
  if (!warnedAboutDevKey) {
    warnedAboutDevKey = true;
    console.warn(
      "[crypto] ENCRYPTION_KEY not set — using deterministic dev key. DO NOT use in production.",
    );
  }
  return createHashedDevKey();
}

// Stable 32-byte dev key derived from a fixed string. Not secure, just stable.
function createHashedDevKey(): Buffer {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256")
    .update("servicepilot-dev-key-do-not-use-in-prod")
    .digest();
}

let plaintextWarningShown = new Set<string>();

export function encrypt(plaintext: string): string {
  if (plaintext === "" || plaintext == null) return "";
  const key = resolveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, enc, tag]).toString("base64");
}

export function decrypt(stored: string): string {
  if (!stored) return "";

  // Transition window: legacy plaintext values pass through unchanged.
  // We log a one-time warning per process so we don't spam.
  if (!stored.startsWith(PREFIX)) {
    if (!plaintextWarningShown.has("any")) {
      plaintextWarningShown.add("any");
      console.warn(
        "[crypto] Found plaintext secret value (no 'v1:' prefix). Returning as-is. Run the migration script: npx tsx scripts/migrate-plaintext-tokens.ts",
      );
    }
    return stored;
  }

  const key = resolveKey();
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  if (raw.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("decrypt: ciphertext too short");
  }
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(raw.length - TAG_LEN);
  const enc = raw.subarray(IV_LEN, raw.length - TAG_LEN);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

// Returns true if a stored value is in the legacy plaintext format and needs
// migration. Used by the migration script.
export function isPlaintext(stored: string | null | undefined): boolean {
  if (!stored) return false;
  return !stored.startsWith(PREFIX);
}

// Mask a secret for display in the UI: returns last 4 chars, padded with dots.
export function maskSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  // For display, we don't decrypt — just show last 4 of whatever is stored.
  // Callers pass the already-decrypted secret value, so this masks the real
  // last 4 characters. We never log or return the full secret here.
  const tail = stored.slice(-4);
  return "••••••••" + tail;
}
