#!/usr/bin/env node
/**
 * afterFileEdit hook — inject testing context when domain code changes.
 * stdin: hook JSON (file path in filePath or path field)
 * stdout: { "additional_context": "..." } or nothing
 */
import { readFileSync } from "node:fs";

const TESTING_PATHS = [/^(src\/|tests\/|prisma\/schema\.prisma)/];

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function extractPath(payload) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.filePath,
    payload.path,
    payload.file,
    payload.file_path,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c.replace(/\\/g, "/");
  }
  return null;
}

const raw = readStdin();
if (!raw.trim()) process.exit(0);

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = extractPath(payload);
if (!filePath || !TESTING_PATHS.some((re) => re.test(filePath))) {
  process.exit(0);
}

const context = [
  "**Testing reminder** (project hook): domain file edited.",
  "Before marking work done: (1) `docker compose --profile test run --rm test`",
  "(2) fresh chat → spec-compliance-review for touched story IDs",
  "(3) smoke steps in docs/TESTING-PLAYBOOK.md if UI changed.",
].join(" ");

process.stdout.write(JSON.stringify({ additional_context: context }));
