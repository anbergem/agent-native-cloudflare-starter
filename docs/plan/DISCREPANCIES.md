# Discrepancies between the plan and reality

Append-only. One entry per discrepancy. Newest at the bottom. Never delete an entry; if it is
resolved, add a `Resolution:` line.

Template:

```
## <YYYY-MM-DD> <task id> — <one-line title>

Expected (plan reference): <file and section of the plan that made the assumption>
Observed: <exactly what you saw: command, output, file path, line>
Impact: <which task steps are blocked or changed>
Proposed handling: <what you did instead, or "blocked, needs a decision">
Resolution: <filled in later by the maintainer>
```

---

## 2026-09-06 T00 — `pnpm-workspace.yaml` has no `workerd` placeholder line

Expected (plan reference): `docs/plan/02-framework-facts.md` F1 ("The scaffold leaves a
placeholder line `workerd: set this to true or false`; it must become `workerd: true`. Also
needed: `better-sqlite3`, `esbuild`, `node-pty`, `@resvg/resvg-js`.") and
`docs/plan/tasks/T00-scaffold.md` step 6 ("replace the line `workerd: set this to true or
false` with `workerd: true`").

Observed: after `CI=1 npx @agent-native/core@0.176.5 create example-jobs --standalone
--template chat --yes`, the generated `pnpm-workspace.yaml` `allowBuilds` block reads exactly:

```
allowBuilds:
  tesseract.js: true
  node-pty: true
  esbuild: true
  better-sqlite3: true
```

There is no `workerd` line at all (placeholder or otherwise), and no `@resvg/resvg-js` line.
Plausible cause: the `chat` template does not depend on `wrangler`, so `workerd` is not in its
dependency graph until this task adds `wrangler` as a devDependency.

Impact: T00 step 6 as literally written cannot be executed (there is no line to replace). No
other step is affected.

Proposed handling: added `workerd: true` as a new entry at the end of the existing
`allowBuilds` block, which reaches the end state F1 requires, and left the rest of the file
untouched. `@resvg/resvg-js` was not added, because step 6 says to leave the rest untouched and
nothing in the dependency graph after `pnpm install` requires it — `pnpm install` completed with
no "ignored build scripts" warning and `workerd@1.20260903.1` plus
`@cloudflare/workerd-darwin-arm64@1.20260903.1` built successfully.

Resolution:

## 2026-09-06 T00 — `pnpm doctor` runs pnpm's built-in doctor, not `agent-native doctor`

Expected (plan reference): `docs/plan/tasks/T00-scaffold.md` "Acceptance" lists `pnpm doctor`,
and `docs/plan/02-framework-facts.md` F3 records the scaffold script `doctor` =
`agent-native doctor`, so the acceptance command was clearly meant to run the framework doctor.

Observed: pnpm 11.23.0 has a built-in `doctor` command, which shadows the `doctor` script in
`package.json`. `pnpm doctor` prints pnpm environment checks ("Versions: pnpm 11.23.0,
Node.js 26.6.0 … All checks passed") and exits 0; it never invokes `agent-native`. The
framework doctor is reached with `pnpm run doctor` (or the scaffold's `pnpm agent-native:doctor`
alias), which prints "agent-native doctor: … Clean — no findings." and also exits 0.

Impact: none for T00 — both commands exit 0 and both outputs are recorded in the pull request.
Later tasks that rely on the framework guards (`no-drizzle-push`, `no-empty-migrations`,
`no-unscoped-queries`, …) must use `pnpm run doctor`, not `pnpm doctor`.

Proposed handling: ran both and recorded both outputs. Suggest T01, which owns the script
table, standardises on an unambiguous script name for the framework doctor and that later task
files and CI use `pnpm run doctor`.

Resolution:
