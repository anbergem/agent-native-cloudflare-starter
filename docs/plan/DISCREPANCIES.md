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
`no-unscoped-queries`, …) must use `pnpm run doctor` or `pnpm agent-native:doctor`, not bare `pnpm doctor`.

Proposed handling: ran both and recorded both outputs. Suggest T01, which owns the script
table, standardises on an unambiguous script name for the framework doctor and that later task
files and CI use `pnpm run doctor`.

Resolution: 2026-09-06 — the plan now uses the script name `agent-native:doctor` everywhere (B15, T01, all acceptance blocks); no script named `doctor` will exist.

## 2026-09-06 T01 — `git check-ignore -q` rejects more than one pathname

Expected (plan reference): `docs/plan/tasks/T01-toolchain.md` step 5 specifies the check
"`.env` or `.dev.vars` is not ignored (`git check-ignore -q .env .dev.vars`)".

Observed: with git 2.39.5, `git check-ignore -q .env .dev.vars` prints
`fatal: --quiet is only valid with a single pathname` and exits 128, so the check reported a
false finding (".gitignore: .env and .dev.vars must both be git-ignored") on a repository where
both files are correctly ignored. `git check-ignore -q .env` and `git check-ignore -q .dev.vars`
each exit 0.

Impact: T01 step 5 only; the check itself is unchanged in meaning.

Proposed handling: `scripts/check-config-hygiene.mjs` runs `git check-ignore -q <file>` once per
file and reports the offending file by name. No plan change needed beyond the command spelling.

Resolution:

## 2026-09-06 T01 — `oxfmt` reformats the plan's Markdown, so `docs/` and `.agents/` are ignored

Expected (plan reference): `docs/plan/tasks/T01-toolchain.md` step 3 ("`.oxfmtrc.json`: … add an
`ignore` list with the same directories") and step 9 ("fix scaffold formatting only by running
`oxfmt --write .` once"), i.e. the formatter was expected to touch scaffold source only.

Observed: oxfmt 0.66.0 formats Markdown and YAML as well as TS/JS/JSON. `oxfmt --list-different .`
reported 36 files, of which 31 are documents, not scaffold source: `docs/plan/*.md` (the
implementation plan itself, including `03-blueprint.md`), `docs/plan/tasks/T*.md`, and the three
framework-provided `.agents/skills/*/SKILL.md`. On `docs/plan/03-blueprint.md` alone
`oxfmt --write` produced a 941-line diff: it pads every Markdown table and re-wraps the
normative TypeScript inside the fenced code blocks. The config key is also spelled
`ignorePatterns` (per `node_modules/oxfmt/configuration_schema.json`); there is no `ignore` key.

Impact: T01 step 9. Running `oxfmt --write .` literally would rewrite the specification that
every remaining task reads, in a toolchain pull request.

Proposed handling: `.oxfmtrc.json` `ignorePatterns` lists `docs` and `.agents` in addition to the
eight build directories from step 3, so `oxfmt` owns source and root Markdown (`AGENTS.md`,
and later `README.md`/`ARCHITECTURE.md` from T23) but never the plan or the framework skills.
`oxfmt --write .` was then run once over the remainder as step 9 requires.

Resolution:

## 2026-09-06 T01 — `noUncheckedIndexedAccess` breaks two scaffold files

Expected (plan reference): `docs/plan/tasks/T01-toolchain.md` step 8 ("`tsconfig.json`: … `strict:
true`; `noUncheckedIndexedAccess: true`") with `pnpm check` (which runs `agent-native typecheck`)
passing under "Acceptance".

Observed: after enabling the flag, `pnpm typecheck` failed with two pre-existing scaffold errors:

```
app/components/layout/Sidebar.tsx(113,38): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
app/hooks/use-navigation-state.ts(33,38): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
```

Both are the same line, `const value = decodeURIComponent(match[1]).trim();`, inside a
`threadIdFromPath` helper that has already returned when `match` is null.

Impact: T01 step 8 and the acceptance command `pnpm check`.

Proposed handling: changed both to `decodeURIComponent(match[1] ?? "")`. The regex
`/^\/chat\/([^/]+)/` always fills group 1 when it matches, so runtime behaviour is unchanged;
this is the smallest edit that keeps the flag the plan requires. No other scaffold file needed a
change.

Resolution:

## 2026-09-06 T02 — `wrangler.jsonc` is JSONC with trailing commas, which T01's parser rejected

Expected (plan reference): `docs/plan/03-blueprint.md` B14 gives the `wrangler.jsonc` skeleton,
and `docs/plan/tasks/T01-toolchain.md` step 5 / B15 say `scripts/check-config-hygiene.mjs`
parses that file ("no `REPLACE_ME` outside env blocks; secrets not in vars"). T01 implemented
the parse as `JSON.parse(stripJsonComments(source))`, which assumes comments are the only
JSONC-only syntax in the file.

Observed: `oxfmt` 0.66.0 formats `.jsonc` with `trailingComma: "all"` (our `.oxfmtrc.json`), so
after `pnpm lint` every object and array in `wrangler.jsonc` ends with a trailing comma. Removing
them is not an option: `oxfmt --check .`, part of `pnpm lint` and therefore of `pnpm check`,
then reports the file as unformatted. With the commas in place the T01 parser failed:

```
wrangler.jsonc: not parseable as JSON after stripping comments (SyntaxError: Expected double-quoted property name in JSON at position 615 (line 25 column 3))
1 config hygiene finding(s)
```

Impact: T02 step 5 (extending the checker) and the acceptance command `pnpm check`. Without the
fix the checker fails on a correctly formatted `wrangler.jsonc` and its `REPLACE_ME` and
secrets-in-vars rules never run at all.

Proposed handling: added a string-aware `stripTrailingCommas()` next to the existing
`stripJsonComments()` in `scripts/check-config-hygiene.mjs` and composed the two before
`JSON.parse`. Commas are overwritten with spaces rather than deleted so byte offsets in a parse
error still point at the right place in the original file. No behaviour change other than
accepting the JSONC that the repository's own formatter produces.

Resolution:
