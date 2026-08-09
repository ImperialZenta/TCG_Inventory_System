import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertRestoreConfirmation,
  buildStoreBackupFilename,
  RESTORE_CONFIRMATION,
} from "../scripts/destructive-scope.mjs";

const repoRoot = join(import.meta.dirname, "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

/**
 * PL-009 traceability: maps Gherkin Then/And clauses to automated assertions.
 * Manual smoke evidence: docs/operations/SMOKE-LOG.md (2026-08-09 PL-009 row).
 */
describe("PL-009 production store stack separated from development", () => {
  const prodCompose = readRepoFile("docker-compose.prod.yml");
  const devCompose = readRepoFile("docker-compose.yml");
  const entrypoint = readRepoFile("docker-entrypoint.sh");
  const backupScript = readRepoFile("scripts/backup-store.ps1");
  const restoreScript = readRepoFile("scripts/restore-store.ps1");

  describe("Scenario: Production and development stacks run side by side", () => {
    it("Then the store is reachable at localhost:3000 under compose project tcg-prod", () => {
      expect(prodCompose).toMatch(/^name:\s*tcg-prod/m);
      expect(prodCompose).toContain('"3000:3000"');
    });

    it("And the dev stack at localhost:3010 uses a different project and volume", () => {
      expect(devCompose).toContain('"3010:3000"');
      expect(devCompose).not.toMatch(/^name:/m);
      expect(prodCompose).toContain("tcg_prod_pgdata");
      expect(devCompose).toContain("pgdata:");
      expect(devCompose).not.toContain("tcg_prod_pgdata");
    });

    it("And no dev compose command can address the store database (separate host ports)", () => {
      expect(prodCompose).toContain('"5433:5432"');
      expect(devCompose).toContain('"5432:5432"');
    });
  });

  describe("Scenario: Volume removal cannot delete store data", () => {
    it('Then the "tcg_prod_pgdata" volume survives because it is external', () => {
      expect(prodCompose).toMatch(/tcg_prod_pgdata:[\s\S]*external:\s*true/);
    });
  });

  describe("Scenario: Strict migrations refuse the data-loss fallback on a non-empty store", () => {
    it('Given MIGRATE_STRICT is "true" in the production stack', () => {
      expect(prodCompose).toContain('MIGRATE_STRICT: "true"');
    });

    it("Then the container exits with an error when migrate deploy fails on a non-empty database", () => {
      expect(entrypoint).toContain('if [ "$MIGRATE_STRICT" = "true" ]; then');
      expect(entrypoint).toContain(
        "MIGRATE_STRICT=true: migrate deploy failed against a non-empty database; refusing db push.",
      );
      expect(entrypoint).toContain("exit 1");
    });

    it('And "prisma db push --accept-data-loss" is not used after the non-empty failure path', () => {
      const refusal = entrypoint.indexOf(
        "MIGRATE_STRICT=true: migrate deploy failed against a non-empty database; refusing db push.",
      );
      expect(refusal).toBeGreaterThan(-1);
      const exitIdx = entrypoint.indexOf("exit 1", refusal);
      const fiIdx = entrypoint.indexOf("\n  fi", exitIdx);
      const tail = entrypoint.slice(refusal, fiIdx);
      expect(tail).not.toContain("db push --accept-data-loss");
    });
  });

  describe("Scenario: Empty first boot is baselined once", () => {
    it("Then the entrypoint baselines the schema once when no application tables exist", () => {
      expect(entrypoint).toContain('[ "$APP_TABLES" = "0" ]');
      expect(entrypoint).toContain("MIGRATE_STRICT: empty database (first boot)");
      expect(entrypoint).toContain("npx prisma db push --accept-data-loss");
      expect(entrypoint).toContain("mark_all_migrations_applied");
    });

    it("And subsequent starts attempt prisma migrate deploy before the empty-db branch", () => {
      const deployIdx = entrypoint.indexOf("STRICT_OUTPUT=$(npx prisma migrate deploy");
      const emptyIdx = entrypoint.indexOf('[ "$APP_TABLES" = "0" ]');
      expect(deployIdx).toBeGreaterThan(-1);
      expect(emptyIdx).toBeGreaterThan(deployIdx);
    });
  });

  describe("Scenario: Backup script produces a restorable archive", () => {
    it('Then a pg_dump archive name includes timestamp and git ref under backups/store', () => {
      expect(backupScript).toContain('tcg-store-$timestamp-$gitRef.dump');
      expect(backupScript).toContain("backups\\store");
      expect(backupScript).toMatch(/pg_dump.*-Fc/);

      const fileName = buildStoreBackupFilename("2026-08-09-1141", "store-v1");
      expect(fileName).toBe("tcg-store-2026-08-09-1141-store-v1.dump");
      expect(buildStoreBackupFilename("2026-08-09-1200", "feat/pl 009")).toBe(
        "tcg-store-2026-08-09-1200-feat_pl_009.dump",
      );
    });

    it("And restore script targets the production compose file and pg_restore", () => {
      expect(restoreScript).toContain("docker-compose.prod.yml");
      expect(restoreScript).toMatch(/pg_restore.*--clean.*--if-exists/);
    });
  });

  describe("Scenario: Restore requires explicit confirmation", () => {
    it("Then nothing is restored when confirmation is wrong", () => {
      const wrong = assertRestoreConfirmation("DELETE");
      expect(wrong.ok).toBe(false);
      if (!wrong.ok) {
        expect(wrong.message).toContain("-ConfirmRestore RESTORE");
      }
    });

    it("And the script explains the confirmation requirement", () => {
      const missing = assertRestoreConfirmation(undefined);
      expect(missing.ok).toBe(false);
      if (!missing.ok) {
        expect(missing.message).toContain("Refusing to run");
      }
      expect(restoreScript).toContain("destructive-scope.mjs");
      expect(assertRestoreConfirmation(RESTORE_CONFIRMATION).ok).toBe(true);

      expect(() =>
        execSync('node scripts/destructive-scope.mjs restore DELETE', {
          cwd: repoRoot,
          stdio: "pipe",
        }),
      ).toThrow();
    });
  });
});
