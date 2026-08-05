import { readFileSync } from "fs";
import { restoreInventoryBackup } from "../src/lib/backup-restore";

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npm run db:restore-test -- <backup.json>");
    process.exit(1);
  }

  const raw = readFileSync(path, "utf8");

  try {
    const summary = await restoreInventoryBackup(raw);
    console.log(
      `RESTORE OK: ${summary.blockCount} blocks, ${summary.binCount} bins, ${summary.cardLineCount} card lines`,
    );
  } catch (error) {
    console.error("RESTORE FAIL:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
