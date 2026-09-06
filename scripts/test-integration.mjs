#!/usr/bin/env node
// Runs the integration suite (blueprint B15, B18).
//
// A script rather than a bare `vitest` invocation because T13 extends it: the CLI
// surface tests it adds need `pnpm action` runs around the vitest process, and a
// package.json one-liner is the wrong place for that. For now it is one step.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const vitest = path.join(repoRoot, "node_modules", ".bin", "vitest");

const result = spawnSync(
  vitest,
  ["--run", "--config", "vitest.integration.config.ts"],
  { cwd: repoRoot, stdio: "inherit" },
);

if (result.error) {
  console.error(`test:integration: could not start ${vitest}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
