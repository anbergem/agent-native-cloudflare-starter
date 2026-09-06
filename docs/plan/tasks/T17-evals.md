# T17 — Agent evals

Goal: the eval area with three sample evals gated behind `RUN_MODEL_EVALS=1`, runnable against
the Node dev database.

Depends on: T10, T11. Read: F13; B18 (evals row); D15.

## Steps

1. `evals/complete-job.eval.ts`: prompt "Complete the in-progress job for Example Customer A";
   scorers `usesTool("complete-job")`; `evals/list-today.eval.ts`: prompt "Show me today's
   jobs"; scorers `usesTool("list-jobs")` and a `createScorer` named `no-mutations` scoring 1
   when `toolCalls` contains none of the command action names, else 0; `evals/undo.eval.ts`:
   two-turn `history` (user asked to complete a job, assistant confirmed) then prompt "Undo
   that"; scorer `usesTool("undo-operation")`. Each has
   `skipReason: process.env.RUN_MODEL_EVALS ? undefined : "Set RUN_MODEL_EVALS=1 and ANTHROPIC_API_KEY to run model-backed evals"`
   and `threshold: 1`.
2. `package.json`: `eval` per B15. `pnpm eval` with evals skipped must exit 0.
3. `docs/testing.md` gets its evals section in T23; here add `evals/README.md` (10 lines):
   what evals answer versus Playwright, how to run (`pnpm db:reset && pnpm db:seed &&
   RUN_MODEL_EVALS=1 ANTHROPIC_API_KEY=... AGENT_USER_EMAIL=member1@example.invalid
   AGENT_ORG_ID=org_acme pnpm eval`), and that they are not a PR gate.
4. If a key is available, run once and paste the report; otherwise state that only the skipped
   run was verified.

## Deliverables

`evals/*.eval.ts`, `evals/README.md`, `package.json`.

## Acceptance

```bash
pnpm check
pnpm eval           # exits 0 with all evals skipped
```
