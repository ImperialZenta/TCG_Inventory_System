/**
 * Explicit-scope guards for destructive operational scripts (ADR-010 §5, PL-009).
 * Used by scripts/restore-store.ps1 and covered by tests/pl009-prod-separation.test.ts.
 */

export const RESTORE_CONFIRMATION = "RESTORE";

export function assertRestoreConfirmation(
  confirm,
) {
  if (confirm !== RESTORE_CONFIRMATION) {
    return {
      ok: false,
      message:
        "Refusing to run: pass -ConfirmRestore RESTORE to acknowledge this replaces all production store data.",
    };
  }
  return { ok: true };
}

/** Matches scripts/backup-store.ps1 filename: tcg-store-YYYY-MM-DD-HHmm-<gitRef>.dump */
export function buildStoreBackupFilename(timestamp, gitRef) {
  const safeRef = gitRef.replace(/[^A-Za-z0-9._-]/g, "_");
  return `tcg-store-${timestamp}-${safeRef}.dump`;
}

const isCli = process.argv[1]?.replace(/\\/g, "/").endsWith("destructive-scope.mjs");

if (isCli) {
  const mode = process.argv[2];
  if (mode === "restore") {
    const result = assertRestoreConfirmation(process.argv[3]);
    if (!result.ok) {
      console.error(result.message);
      process.exit(1);
    }
  }
}
