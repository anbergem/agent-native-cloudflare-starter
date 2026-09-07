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

`scripts/run-evals.mjs` creates a temporary SQLite database, applies `migrations/`, seeds the
deterministic scenario (B12), and runs `agent-native eval` as
`AGENT_USER_EMAIL=member1@example.invalid` in `AGENT_ORG_ID=org_acme` unless the environment
overrides them. Never commit a credential.

`accounting-approval` must pause for explicit human approval and leave no export request;
`member-denial` must end in an authorization denial, not merely pick the right tool.

These evaluations are release evidence (D27), not a pull-request gate.
