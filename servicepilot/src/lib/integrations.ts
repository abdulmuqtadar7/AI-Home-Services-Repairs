// src/lib/integrations.ts
// Transparent encrypt-on-write / decrypt-on-read wrapper for IntegrationSetting.
// All access to IntegrationSetting.twilioAuthToken MUST go through this module.
// Direct prisma.integrationSetting access is forbidden outside this file and
// the one-time migration script.

import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

// Fields whose values are secrets and must be encrypted at rest.
// stripeAccountId is excluded: it is an account identifier, not a secret.
const ENCRYPTED_FIELDS = [
  "twilioAuthToken",
  "googleMapsApiKey",
  "zapierWebhookUrl",
] as const;

function decryptRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const f of ENCRYPTED_FIELDS) {
    const v = out[f];
    if (typeof v === "string" && v.length > 0) out[f] = decrypt(v);
  }
  return out as T;
}

// Shape returned to callers — twilioAuthToken is decrypted plaintext.
export type DecryptedIntegrationSetting = {
  id: string;
  businessId: string;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioPhoneNumber: string | null;
  whatsappNumber: string | null;
  stripeAccountId: string | null;
  googleCalendarId: string | null;
  googleMapsApiKey: string | null;
  zapierWebhookUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Patch shape for updates — twilioAuthToken is plaintext from the caller,
// will be encrypted before being persisted.
export type IntegrationSettingPatch = {
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
  twilioPhoneNumber?: string | null;
  whatsappNumber?: string | null;
  stripeAccountId?: string | null;
  googleCalendarId?: string | null;
  googleMapsApiKey?: string | null;
  zapierWebhookUrl?: string | null;
};

export async function getIntegrationSetting(
  businessId: string,
): Promise<DecryptedIntegrationSetting | null> {
  const row = await prisma.integrationSetting.findUnique({
    where: { businessId },
  });
  if (!row) return null;
  return decryptRow(row);
}

export async function updateIntegrationSetting(
  businessId: string,
  patch: IntegrationSettingPatch,
): Promise<DecryptedIntegrationSetting> {
  // Build the persistence payload. Encrypt the auth token if present;
  // empty/null means "clear the stored value".
  const data: IntegrationSettingPatch = { ...patch };
  for (const f of ENCRYPTED_FIELDS) {
    const val = (patch as Record<string, unknown>)[f];
    if (val !== undefined) {
      (data as Record<string, unknown>)[f] =
        typeof val === "string" && val.length > 0 ? encrypt(val) : null;
    }
  }

  // Upsert: a row may not exist yet for new businesses.
  const row = await prisma.integrationSetting.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  });

  return decryptRow(row);
}

// Convenience for twilio.ts: returns decrypted Twilio creds for a business,
// or null if the tenant hasn't configured their own Twilio account.
export async function getTwilioCredsForBusiness(businessId: string): Promise<{
  accountSid: string;
  authToken: string;
  phoneNumber: string;
} | null> {
  const s = await getIntegrationSetting(businessId);
  if (s?.twilioAccountSid && s?.twilioAuthToken && s?.twilioPhoneNumber) {
    return {
      accountSid: s.twilioAccountSid,
      authToken: s.twilioAuthToken,
      phoneNumber: s.twilioPhoneNumber,
    };
  }
  return null;
}
