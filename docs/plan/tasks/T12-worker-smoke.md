# T12 — Worker smoke script

Goal: `scripts/worker-smoke.mjs` implementing the B19 contract for local, staging and production.

Depends on: T10, T11. Read: F9, F12; B19.

## Steps

1. Implement the script with `fetch` (Node 22 global), a cookie jar for the QA session (parse
   `set-cookie`, send `cookie`), `--run-id` (default `<timestamp>`), one check per row of the
   B19 table gated by `--mode`, output `[ok] <check>` / `[fail] <check>: <detail>`, exit 1 on
   any failure, overall timeout 120 s. Readiness: retry `ping` up to 60 times with 2 s sleeps
   before the first check. Agent-chat check: read the first 2 KB of the SSE body.
2. `package.json`: `smoke` per B15.
3. Verify locally: `pnpm build:worker && pnpm db:reset && pnpm dev:worker:serve` (background)
   `&& pnpm db:seed:worker && pnpm smoke -- --qa-email owner@example.invalid --qa-password
   Example-Seed-Password-2026 --expect-org-id org_acme` passes every local-mode check.

## Deliverables

`scripts/worker-smoke.mjs`, `package.json`.

## Acceptance

```bash
pnpm check
```
plus the step 3 transcript showing every `[ok]` line.
