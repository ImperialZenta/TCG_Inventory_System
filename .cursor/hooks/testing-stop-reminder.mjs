#!/usr/bin/env node
/**
 * stop hook — suggest testing checklist when src/tests/prisma changed in working tree.
 * stdout: { "followup_message": "..." } or nothing
 */
import { execSync } from "node:child_process";

function gitChangedFiles() {
  const names = new Set();
  const commands = [
    "git diff --name-only HEAD",
    "git diff --name-only --cached HEAD",
    "git ls-files --others --exclude-standard",
  ];
  for (const cmd of commands) {
    try {
      const out = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      for (const line of out.split("\n")) {
        const trimmed = line.trim().replace(/\\/g, "/");
        if (trimmed) names.add(trimmed);
      }
    } catch {
      // ignore — not a git repo or git unavailable
    }
  }
  return [...names];
}

const TESTING_PREFIXES = ["src/", "tests/", "prisma/schema.prisma", "prisma/migrations/"];

const changed = gitChangedFiles();
const touched = changed.filter((f) =>
  TESTING_PREFIXES.some((p) => f === p || f.startsWith(p)),
);

if (touched.length === 0) {
  process.exit(0);
}

const sample = touched.slice(0, 5).join(", ");
const more = touched.length > 5 ? ` (+${touched.length - 5} more)` : "";

const message = [
  "## Testing checklist (auto-reminder)",
  "",
  "This session changed domain code. Before you move on:",
  "",
  "1. **Regression gate** — `docker compose --profile test run --rm test`",
  "2. **Agent B** — fresh chat: `Read .cursor/skills/spec-compliance-review/SKILL.md and review story {ID}`",
  "3. **Smoke** — Phase 4 golden path in `docs/TESTING-PLAYBOOK.md` (if picking/orders/blocks UI touched)",
  "",
  `Changed: ${sample}${more}`,
  "",
  "Log smoke results in `docs/operations/SMOKE-LOG.md` when you run manual checks.",
].join("\n");

process.stdout.write(JSON.stringify({ followup_message: message }));
