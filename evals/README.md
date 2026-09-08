# Agent evaluations

These evaluations ask whether the model selects the right action, aims it at the right target,
gets a successful tool result, and leaves the intended state behind. Playwright asserts
deterministic browser and HTTP behaviour without judging any model choice.

`pnpm eval` exits 0 with every case skipped when `RUN_MODEL_EVALS` is unset; that proves
discovery and gating only, never model behaviour.

A model-backed run needs a provider credential and owns its own database, so no
`pnpm db:reset && pnpm db:seed` is required:

```bash
RUN_MODEL_EVALS=1 ANTHROPIC_API_KEY=... pnpm eval
```

To keep the report as release evidence, use `--out` rather than a shell redirection:

```bash
RUN_MODEL_EVALS=1 pnpm eval -- --out eval-evidence.json
```

`--out` implies `--json` and the script writes the file itself, so the document survives any
wrapper. Do **not** redirect: `pnpm run` writes `[ELIFECYCLE] Command failed with exit code 1.`
to **stdout** when a script exits non-zero, appending a line after the closing brace on exactly
the runs worth keeping. The exit code still gates, so `--out` is safe in CI.
`eval-evidence*.json` is git-ignored: the report carries prompts, model output and provider
request ids.

`scripts/run-evals.mjs` creates a temporary SQLite database, applies `migrations/`, seeds the
deterministic scenario (B12), and runs `scripts/eval-suite.ts` as
`AGENT_USER_EMAIL=member1@example.invalid` in `AGENT_ORG_ID=org_acme` unless the environment
overrides them. Never commit a credential.

The driver replaces `agent-native eval`, which supplies no system prompt: the Anthropic engine then
caches an empty system block and the API rejects every request
(`system.0: cache_control cannot be set for empty text blocks`). `scripts/eval-suite.ts` passes
`instructions.runtime` from `agent-native.config.ts`, so these evals score the agent this app
deploys rather than a tool-equipped agent with no instructions.

A scorer asserting an _absence_ passes vacuously when the agent never ran, so treat any per-eval
`error` as "nothing was evaluated" regardless of the scores beside it.

`accounting-approval` must pause for explicit human approval and leave no export request;
`member-denial` must end in an authorization denial, not merely pick the right tool.

These evaluations are release evidence (D27), not a pull-request gate.
