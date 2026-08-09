#!/usr/bin/env node
/**
 * Apply schema in Docker/dev without migrate dev's shadow database.
 * Matches docker-entrypoint.sh: deploy pending migrations, fall back to db push.
 */
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LOG = join(process.cwd(), "debug-0485b1.log");
const sessionId = "0485b1";

function debugLog(hypothesisId, message, data, runId = "apply") {
  // #region agent log
  try {
    appendFileSync(
      LOG,
      JSON.stringify({
        sessionId,
        hypothesisId,
        location: "scripts/db-apply.mjs",
        message,
        data,
        timestamp: Date.now(),
        runId,
      }) + "\n",
    );
  } catch {
    /* ignore */
  }
  // #endregion
}

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function runAllowFail(cmd) {
  try {
    return { ok: true, output: run(cmd) };
  } catch (e) {
    return {
      ok: false,
      output: (e.stdout || "") + (e.stderr || ""),
      code: e.status ?? 1,
    };
  }
}

function listMigrations() {
  const dir = join(process.cwd(), "prisma", "migrations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => !n.includes("."));
}

function markAllMigrationsApplied() {
  for (const name of listMigrations()) {
    runAllowFail(`npx prisma migrate resolve --applied "${name}"`);
  }
}

const migrations = listMigrations();
debugLog("H1", "starting db-apply", { migrationCount: migrations.length, migrations });

const deploy = runAllowFail("npx prisma migrate deploy");
debugLog("H3", "migrate deploy", { ok: deploy.ok, output: deploy.output.slice(0, 600) });

if (deploy.ok) {
  console.log(deploy.output);
  debugLog("H3", "success via migrate deploy", {});
  process.exit(0);
}

console.error(deploy.output);

const needsBaseline =
  deploy.output.includes("P3005") ||
  deploy.output.includes("P3009") ||
  deploy.output.includes("P1014") ||
  deploy.output.includes("P3006");

debugLog("H2", "deploy failed", { needsBaseline, hasP3006: deploy.output.includes("P3006") });

if (needsBaseline) {
  console.log("Migration deploy unavailable; syncing schema with prisma db push...");
  const push = runAllowFail("npx prisma db push --accept-data-loss");
  debugLog("H4", "db push fallback", { ok: push.ok, output: push.output.slice(0, 600) });

  if (!push.ok) {
    console.error(push.output);
    process.exit(push.code ?? 1);
  }

  console.log(push.output);
  markAllMigrationsApplied();
  debugLog("H4", "success via db push + baseline", {});
  process.exit(0);
}

process.exit(deploy.code ?? 1);
