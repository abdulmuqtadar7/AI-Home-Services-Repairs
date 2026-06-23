// src/lib/integrations.ts
// Transparent encrypt-on-write / decrypt-on-read wrapper for IntegrationSetting.
// All access to IntegrationSetting.twilioAuthToken MUST go through this module.
// Direct prisma.integrationSetting access is forbidden outside this file and
// the one-time migration script.

import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

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
  return {
    ...row,
    twilioAuthToken: row.twilioAuthToken ? decrypt(row.twilioAuthToken) : null,
  };
}

export async function updateIntegrationSetting(
  businessId: string,
  patch: IntegrationSettingPatch,
): Promise<DecryptedIntegrationSetting> {
  // Build the persistence payload. Encrypt the auth token if present;
  // empty/null means "clear the stored value".
  const data: IntegrationSettingPatch = { ...patch };
  if (patch.twilioAuthToken !== undefined) {
    data.twilioAuthToken = patch.twilioAuthToken ? encrypt(patch.twilioAuthToken) : null;
  }

  // Upsert: a row may not exist yet for new businesses.
  const row = await prisma.integrationSetting.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
  });

  return {
    ...row,
    twilioAuthToken: row.twilioAuthToken ? decrypt(row.twilioAuthToken) : null,
  };
}

// Convenience for twilio.ts: returns decrypted Twilio creds for a business,
// or null if the tenant hasn't configured their own Twilio account.
export async function getTwilioCredsForBusiness(
  businessId: string,
): Promise<{
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
