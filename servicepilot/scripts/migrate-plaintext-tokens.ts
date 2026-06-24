// scripts/migrate-plaintext-tokens.ts
// One-time migration: encrypt any plaintext IntegrationSetting secret fields
// in place. Idempotent and safe to run multiple times.
//
// Run with: npx tsx scripts/migrate-plaintext-tokens.ts
//
// Covers secret fields: twilioAuthToken, googleMapsApiKey, zapierWebhookUrl.
// stripeAccountId is intentionally excluded (an identifier, not a secret).

import { prisma } from "../src/lib/prisma";
import { encrypt, isPlaintext } from "../src/lib/crypto";

const SECRET_FIELDS = [
  "twilioAuthToken",
  "googleMapsApiKey",
  "zapierWebhookUrl",
] as const;

async function main() {
  console.log(
    "Scanning IntegrationSetting rows for plaintext secret fields...",
  );

  const rows = await prisma.integrationSetting.findMany();
  console.log("Found " + rows.length + " IntegrationSetting row(s) total.");

  let migrated = 0;
  let alreadyEncrypted = 0;
  let empty = 0;

  for (const row of rows) {
    const patch: Record<string, string> = {};
    for (const field of SECRET_FIELDS) {
      const value = (row as Record<string, unknown>)[field];
      if (typeof value !== "string" || value.length === 0) {
        empty++;
        continue;
      }
      if (isPlaintext(value) === false) {
        alreadyEncrypted++;
        continue;
      }
      patch[field] = encrypt(value);
      migrated++;
      console.log("  Migrating " + field + " on row " + row.id);
    }
    if (Object.keys(patch).length > 0) {
      await prisma.integrationSetting.update({
        where: { id: row.id },
        data: patch,
      });
    }
  }

  console.log("");
  console.log("Migration complete.");
  console.log("  Total rows scanned: " + rows.length);
  console.log("  Fields migrated (plaintext to encrypted): " + migrated);
  console.log("  Fields already encrypted (v1:): " + alreadyEncrypted);
  console.log("  Fields empty (no value stored): " + empty);

  if (migrated === 0) {
    console.log("");
    console.log(
      "Nothing to migrate. All secret fields are already encrypted or empty.",
    );
  }
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
