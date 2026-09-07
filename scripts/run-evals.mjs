#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = mkdtempSync(path.join(tmpdir(), "example-jobs-evals-"));
const databaseUrl = `file:${path.join(temporary, "evals.db")}`;
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  AGENT_USER_EMAIL: process.env.AGENT_USER_EMAIL ?? "member1@example.invalid",
  AGENT_ORG_ID: process.env.AGENT_ORG_ID ?? "org_acme",
  // `agent-native eval` imports the `*.eval.ts` files in a plain Node process
  // (bin/agent-native.js runs the shipped build), so type stripping is all the
  // runtime offers: it cannot resolve the extensionless imports the
  // application layers use. tsx's resolver can, and the evals reach the real
  // use cases through it.
  NODE_OPTIONS: "--import tsx",
};

function run(args) {
  const result = spawnSync("pnpm", args, { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  return result.status === 0;
}

try {
  // The same test-only switch the eval files read (evals/helpers.ts); a
  // model-backed run needs a migrated and seeded database, a skipped run does
  // not.
  // guard:allow-env-credential — test-only run switch, not a credential
  if (process.env.RUN_MODEL_EVALS === "1") {
    if (!run(["exec", "node", "scripts/migrate-local.mjs"])) process.exit();
    if (!run(["exec", "tsx", "tests/fixtures/seed-sql-only.ts"]))
      process.exit();
  }
  run(["exec", "agent-native", "eval", ...process.argv.slice(2)]);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
