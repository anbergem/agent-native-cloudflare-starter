/**
 * Builds the database the integration suite runs against (blueprint B18).
 *
 * Deleted and re-migrated on every run, from `migrations/` only, so a test can
 * assert on row counts and a schema change cannot be masked by a file left
 * over from a previous run. The file is `data/test-integration.db`, which is
 * git-ignored along with the rest of `data/`, and is never the database
 * `pnpm dev` uses.
 *
 * `DATABASE_URL` is set here rather than in a test file because the framework
 * resolves it once, when its executor first initialises, and that happens on
 * the first `getDbExec().execute()` in the worker process — long after the
 * first `import` of `@agent-native/core/db`, but not something a test should
 * have to sequence by hand.
 */

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const TEST_DATABASE_URL = "file:./data/test-integration.db";

const databaseFile = path.join(repoRoot, "data", "test-integration.db");

export default function setup(): void {
  // guard:allow-env-mutation — test harness, before any worker starts; the framework resolves DATABASE_URL once, at first use
  process.env.DATABASE_URL = TEST_DATABASE_URL;

  // `-wal` and `-shm` outlive the database file itself; leaving them behind
  // would attach a previous run's uncheckpointed pages to the new file.
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`${databaseFile}${suffix}`, { force: true });
  }

  // The same runner `pnpm db:migrate` uses, in a child process so it reads the
  // environment above rather than whatever this process inherited.
  const migrated = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "migrate-local.mjs")],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    },
  );
  if (migrated.status !== 0) {
    throw new Error(
      `integration setup: scripts/migrate-local.mjs exited with ${migrated.status ?? migrated.signal}`,
    );
  }
}
