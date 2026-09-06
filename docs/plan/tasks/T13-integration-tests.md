# T13 — Integration tests through the CLI surface

Goal: prove action-layer parity without a model: the same use case invoked through the framework
CLI runner behaves like the HTTP surface, against a fresh Node SQLite database.

Depends on: T10, T11. Read: F6 (CLI identity), F13; B18 (integration row).

## Steps

1. Extend `scripts/test-integration.mjs`: (1) set `DATABASE_URL=file:./data/test-integration.db`,
   delete the file, run `scripts/migrate-local.mjs`; (2) create the framework's `organizations`
   and `org_members` tables with the DDL from F6 (they are framework-owned and absent in a
   database no server has touched, T11; reuse the DDL already hand-written in
   `tests/integration/repositories.test.ts` by moving it to `tests/integration/framework-tables.ts`),
   then execute `buildScenarioSql()` via `@libsql/client` (run the seeding step as
   `pnpm exec tsx tests/fixtures/seed-sql-only.ts`, a tiny script you add that creates those two
   tables if missing and applies the scenario SQL to `DATABASE_URL`; `tests/fixtures/scenario-sql.ts`
   from T11 already exposes the statements); (3) run `vitest --run --config vitest.integration.config.ts`; (4) run the CLI
   checks below with `child_process.spawnSync("pnpm", ["action", ...], { env })` and assert on
   parsed stdout; fail on mismatch.
2. CLI checks (env `AGENT_USER_EMAIL`, `AGENT_ORG_ID`, `DATABASE_URL` as above):
   `member1@example.invalid`/`org_acme` `complete-job '{"jobId":"job_in_progress"}'` → stdout JSON
   `resource.status === "completed"`, `resource.version === 3`; then `list-recent-activity` shows
   the new `complete-job` operation with `performedVia: "cli"`; `undo-operation` with that id →
   `resource.status === "in_progress"`; `member1`/`org_other` `get-job '{"jobId":"job_scheduled"}'`
   → non-zero exit and stderr containing `NOT_FOUND`; `member1`/`org_acme`
   `archive-customer '{"customerId":"cus_b"}'` → stderr containing `AUTHORIZATION`;
   `admin@example.invalid`/`org_acme` same call → success.
3. `tests/integration/use-cases-d1.test.ts`: run the B9 concurrency scenario against the real
   repositories (two actors, real versions).

## Deliverables

`scripts/test-integration.mjs`, `tests/fixtures/seed-sql-only.ts`,
`tests/integration/use-cases-d1.test.ts`.

## Acceptance

```bash
pnpm check
pnpm test:integration
```
