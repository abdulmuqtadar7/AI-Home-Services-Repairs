// scripts/migrate-plaintext-tokens.ts
// One-time migration: encrypt any plaintext IntegrationSetting.twilioAuthToken
// values in place. Idempotent — safe to run multiple times.
//
// Run with: npx tsx scripts/migrate-plaintext-tokens.ts
//
// What it does:
// 1. Loads all IntegrationSetting rows.
// 2. For each row, checks if twilioAuthToken is in the "v1:" encrypted format.
// 3. If not (i.e. plaintext), encrypts it and updates the row.
// 4. Prints a summary: total rows scanned, rows migrated, rows already encrypted.

import { prisma } from "../src/lib/prisma";
import { encrypt, isPlaintext } from "../src/lib/crypto";

async function main() {
  console.log("Scanning IntegrationSetting rows for plaintext twilioAuthToken...");

  const rows = await prisma.integrationSetting.findMany({
    select: { id: true, businessId: true, twilioAuthToken: true },
  });
  console.log(`Found ${rows.length} IntegrationSetting row(s) total.`);

  let migrated = 0;
  let alreadyEncrypted = 0;
  let empty = 0;

  for (const row of rows) {
    if (!row.twilioAuthToken) {
      empty++;
      continue;
    }
    if (!isPlaintext(row.twilioAuthToken)) {
      alreadyEncrypted++;
      continue;
    }
    // It's plaintext — encrypt and update.
    const encrypted = encrypt(row.twilioAuthToken);
    await prisma.integrationSetting.update({
      where: { id: row.id },
      data: { twilioAuthToken: encrypted },
    });
    migrated++;
    console.log(`  Migrated row ${row.id} (business ${row.businessId})`);
  }

  console.log("");
  console.log("Migration complete.");
  console.log(`  Total rows scanned: ${rows.length}`);
  console.log(`  Plaintext -> encrypted: ${migrated}`);
  console.log(`  Already encrypted (v1:): ${alreadyEncrypted}`);
  console.log(`  Empty (no token stored): ${empty}`);

  if (migrated === 0) {
    console.log("");
    console.log("Nothing to migrate. All tokens are already encrypted (or empty).");
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
