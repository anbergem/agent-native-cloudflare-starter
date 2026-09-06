# T16 — Playwright end-to-end suite

Goal: the hermetic browser suite from B18 running against the built Worker on local D1.

Depends on: T12, T15. Read: F6, F9; B12, B18, B19.

## Steps

1. `scripts/e2e-server.mjs`: `rm -rf .wrangler/state`; `wrangler d1 migrations apply
   example-jobs-local --local`; spawn `wrangler dev --port 8787 --ip 127.0.0.1 --local`
   (inherit stdio, keep the child); poll `http://127.0.0.1:8787/_agent-native/ping`; request
   `/_agent-native/health` once (this makes the framework create `organizations`,
   `org_members` and its other tables — they do not exist before the first request, T11);
   then apply the scenario SQL with `node scripts/seed.mjs --target d1-local --skip-users`
   (which runs `wrangler d1 execute example-jobs-local --local --file` while the server runs,
   verified in T11); keep the process alive until killed and forward SIGTERM/SIGINT to the
   child. Requires `dist/`; exit 1 with a message if missing.
2. `playwright.config.ts`: `testDir: "tests/e2e"`, `workers: 1`, `fullyParallel: false`,
   `retries: process.env.CI ? 1 : 0`, `reporter: [["list"], ["html", { open: "never" }]]`,
   `use: { baseURL: "http://127.0.0.1:8787", trace: "on-first-retry" }`,
   `webServer: { command: "node scripts/e2e-server.mjs", url: "http://127.0.0.1:8787/_agent-native/ping", timeout: 180_000, reuseExistingServer: false }`,
   `globalSetup: "tests/e2e/global-setup.ts"`, one `chromium` project.
3. `tests/e2e/global-setup.ts`: the scenario SQL was applied by the server script; here only
   register the five users over HTTP (`node scripts/seed.mjs` cannot be reused for that alone,
   so call the register/login endpoints directly, treating HTTP 409 as "exists") and log each in,
   saving storage state to `tests/e2e/.auth/<name>.json`; then run the local-mode smoke
   (`scripts/worker-smoke.mjs` as a child process with the owner QA credentials) and fail setup
   if it fails.
4. `tests/e2e/fixtures.ts`: `test` extended with `ownerPage`, `adminPage`, `memberPage`,
   `outsiderPage` (new context per fixture from the stored state) and an `assertSameOrigin`
   auto-fixture that registers `page.on("request")` and throws on any URL whose origin differs
   from `baseURL` (allow `data:` and `blob:`).
5. Specs (one file each): `auth.spec.ts` (owner loads `/jobs`, header shows the email and
   "Acme Services"); `jobs-list.spec.ts` (member sees three jobs); `complete-job.spec.ts`
   (member completes `job_in_progress`; status badge updates; activity page shows the
   operation; `GET /_agent-native/actions/list-audit-events?targetType=job&targetId=job_in_progress`
   via `page.request` contains `action: "complete-job"`, `caller: "frontend"`); `undo.spec.ts`
   (complete then Undo from the toast; status restored; activity shows an `undo` operation);
   `undo-conflict.spec.ts` (member completes `job_scheduled` in the UI; admin reschedules it via
   `page.request.post("/_agent-native/actions/reschedule-job")`; member clicks Undo; the UI shows
   the CONFLICT message; status stays completed); `isolation.spec.ts` (outsider visits
   `/jobs/job_scheduled` and sees the not-found state; `page.request.get(".../get-job?jobId=job_scheduled")`
   returns 404); `authorization.spec.ts` (member's `page.request.post(".../archive-customer")`
   returns 403 with `errorCode: "AUTHORIZATION"`; admin's returns 200); `parity.spec.ts`
   (member calls `complete-job` for `job_in_progress` via `page.request` (caller `http`), then the
   audit trail lists the row with `caller: "http"`, and the job page reflects the change).
6. `package.json`: `test:e2e`, `test:e2e:full` per B15; add `playwright-report/` and
   `test-results/` to `.gitignore` (T00 did).

## Deliverables

`scripts/e2e-server.mjs`, `playwright.config.ts`, `tests/e2e/{global-setup.ts,fixtures.ts,*.spec.ts}`,
`package.json`.

## Acceptance

```bash
pnpm check
pnpm exec playwright install --with-deps chromium
pnpm test:e2e:full
```
