# Framework upgrade playbook

Renovate opens the pull request — framework packages arrive grouped as "agent-native framework"
with the `framework-upgrade` label, held for three days after release, and never automerged
(`renovate.json`, D22). This is what a human does with that pull request. Work through it in
order; every step is a gate, not a suggestion.

1. Read the Agent-Native and Wrangler release notes for every proposed version. Identify changes to actions, authentication, database drivers, Worker output, and deployment commands before editing dependencies.
2. Update the exact `@agent-native/core` and `@agent-native/toolkit` pins. Keep related framework packages in one reviewed change. Update Wrangler separately unless the versions must move together for compatibility.
3. Run `pnpm install` and review both `package.json` and `pnpm-lock.yaml`. Do not discard unrelated lockfile changes without understanding their source.
4. Run `pnpm exec agent-native upgrade check`, then `pnpm exec agent-native doctor --only migration-manifest`. Apply scheduled import migrations deliberately; do not run a blind framework upgrade rewrite.
5. Run `pnpm check` and `pnpm test:integration`.
6. Run `pnpm build:worker`. The post-build compatibility patch intentionally fails first when the generated stub shape changes. If it reports zero or multiple matches, inspect `dist/_worker.js/index.js` around `"fs."+String(` and `"os."+String(`, re-derive narrowly bounded patterns, and update the patch tests. If upstream fixed both default-export stubs, remove the patch only after the Worker smoke passes without it.
7. Run `pnpm verify:worker`. This creates a fresh temporary local D1 state, migrates and seeds it, starts the built Worker, exercises the real action flow, and removes only its own temporary state.
8. Run `pnpm test:e2e:full`. Confirm authenticated reads, writes, undo, approval gating, and organization isolation through the Worker surface.
9. Re-check the version-sensitive facts in `docs/plan/02-framework-facts.md`, especially F5 action/runtime APIs, F9 Worker configuration and bundle behavior, F12 agent chat behavior, and F14 localization. Update evidence and any affected guard.
10. Run the opt-in model evaluations with an explicitly configured provider credential. Record correct target, successful tool result, persisted state, human approval behavior, and member denial. If no credential is available, report this release evidence as pending; a skipped run is not model validation.
11. Merge only after review and green checks, then watch the staging migration, deployment, seed, and smoke run. Promote the exact staging artifact using its run id.

Compatibility workarounds are bounded exceptions. A new runtime patch or broader generated-code rewrite requires reassessing whether the Node/libSQL fallback is safer before making the workaround permanent.
