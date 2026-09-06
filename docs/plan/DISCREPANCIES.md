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

Resolution: 2026-09-06 — F1 rewritten to the observed scaffold (add `workerd: true`).
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

Resolution: 2026-09-06 — Accepted; the checker tests one path at a time.
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

Resolution: 2026-09-06 — Accepted; `docs/` and `.agents/` stay ignored by oxfmt.
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

Resolution: 2026-09-06 — Accepted; the two scaffold fixes are the intended behaviour.
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

Resolution: 2026-09-06 — Fixed in `scripts/check-config-hygiene.mjs` (string-aware trailing-comma stripper).
## 2026-09-06 T03 — the `chat` template's Sidebar has no Database or Extensions entries

Expected (plan reference): `docs/plan/tasks/T03-framework-config.md` step 10 ("Remove
navigation entries for Database and Extensions in `app/components/layout/Sidebar.tsx` and the
`i18n` keys that reference them") and D12 ("The template's database browser page and extensions
pages are removed").

Observed: `app/components/layout/Sidebar.tsx` as generated by the `chat` template has exactly
two navigation lists — `navItems` with one entry (Chat, `/home`) and `bottomNavItems` with one
entry (Settings, `/settings`). There is no Database entry, no Extensions entry, and no
`/database` or `/extensions` route anywhere under `app/routes/`. The Database/Extensions
surface D12 describes belongs to the `default` template, not `chat`.

The i18n keys did exist: `navigation.database`, `navigation.extensions` and
`pages.databaseTitle` were present in all eleven `app/i18n/<locale>.ts` catalogs. The only code
that read one of them was a dead branch in `app/components/layout/Header.tsx`:
`if (pathname.startsWith("/extensions")) return t("navigation.extensions");`.

Impact: T03 step 10, the Sidebar half only. Nothing else changes; `Sidebar.tsx` is unchanged in
this pull request even though it is listed under Deliverables.

Proposed handling: removed the three keys from all eleven catalogs as the step requires, and
removed the one dead `Header.tsx` branch that referenced a now-deleted key rather than leave a
`t()` call pointing at nothing. `Sidebar.tsx` needed no edit. The unused
`app/i18n-data.ts` (imported by nothing) still carries the same keys and was left alone; T15
owns the catalogs.

Resolution: 2026-09-06 — Accepted; T03 removed only the dead i18n keys. F3 note stands.
## 2026-09-06 T03 — the sign-in page always contains the string "Continue as local dev"

Expected (plan reference): `docs/plan/tasks/T03-framework-config.md` step 11 ("sign-in page HTML
does not contain `Continue as local dev`") with F7's
`AGENT_NATIVE_DISABLE_AUTO_DEV_ACCOUNT=1` as the mechanism.

Observed: the flag works, but it does not remove the string from the served HTML. In
`node_modules/@agent-native/core/dist/client/auth/AuthPage.js` the local-dev block is rendered
unconditionally and hidden by React state that starts `false`:

```js
const [localDevAvailable, setLocalDevAvailable] = React.useState(false);
...
React.createElement("div", { className: "local-dev-signin", id: "local-dev-signin", hidden: !localDevAvailable },
  React.createElement("button", { ... id: "local-dev-btn", ... }, ... t("localDevButton")),
```

so `curl http://localhost:8080/sign-in` returns markup containing
`id="local-dev-signin" hidden=""` around a button whose label is `Continue as local dev`. The
string also appears a second time in the page's embedded i18n copy blob
(`"localDevButton":"Continue as local dev"`), which is served whatever the flag says.

Impact: T03 step 11's first check as literally written can never pass on 0.176.5.

Proposed handling: verified the behaviour the check was written to protect, three ways instead
of grepping the HTML:
`curl -s http://localhost:8080/_agent-native/auth/local-dev` returns
`{"available":false,"reason":"not-allowed"}` (the button only un-hides when this says `true`);
the served markup carries `id="local-dev-signin" hidden=""`; and in a real browser
`document.getElementById("local-dev-signin").hidden === true`,
`document.body.innerText.includes("Continue as local dev") === false`. A future task that wants
a machine check should assert on the `/_agent-native/auth/local-dev` response, not on the HTML.

Resolution: 2026-09-06 — F7 updated: verify via `GET /_agent-native/auth/local-dev`, never by grepping HTML.
## 2026-09-06 T03 — `createAuthPlugin({ marketing })` serves the sign-in document at `/` and hides the index route

Expected (plan reference): `docs/plan/tasks/T03-framework-config.md` step 4 (keep
`createAuthPlugin`, set `marketing.appName`, remove `workspaceAppPublicPaths`) together with
step 10 (`/` redirects to `/jobs`) and B17 (`/` → redirect `/jobs`).

Observed: with only those two edits, `GET /` returned the sign-in document for **every**
visitor, signed in or not (`<title>Example Jobs — Sign in</title>`), the `_index` route module
was never loaded, and the response carried none of the middleware's security headers. The cause
is in `node_modules/@agent-native/core/dist/server/auth.js`:

```js
rootAuth: options.rootAuth ?? Boolean(options.marketing),
...
if (config.rootAuth && p === "/" && resolveAppHomePath(getAppConfig().app) !== "/" && isHtmlDocumentRequest(event, p)) {
    return loginHtmlResponse(config.loginHtml, event, { includeRootAuthRedirect: true, requestIndependent: true });
}
```

Providing `marketing` at all turns `rootAuth` on, and that branch is deliberately
session-independent ("the cached root document stays identical for every visitor"), so a
signed-in user at `/` is handed off to `app.homePath` — `/home` — and never reaches the redirect
step 10 asks for.

Impact: T03 steps 4, 9 and 10, and the `GET /` part of step 11.

Proposed handling: added `rootAuth: false` to `createAuthPlugin` — one key step 4 does not list,
with a comment saying why. `/` is now an ordinary authenticated page: it loads `routes/_index`,
carries `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`, and an
anonymous visitor is taken through `/jobs` to
`/sign-in?c=JTJGam9icw` (`JTJGam9icw` decodes to `%2Fjobs`) by the framework's client session
gate. The alternative the framework's own comment offers — `app.homePath: "/"` — reaches the
same place and was not used because it would also move the post-sign-in landing page.

Resolution: 2026-09-06 — F7 updated: `rootAuth: false` is required in `createAuthPlugin`.
## 2026-09-06 T03 — a loader `redirect("/jobs")` at `/` breaks the Cloudflare static-shell build

Expected (plan reference): `docs/plan/tasks/T03-framework-config.md` step 10 offers two ways to
implement the root redirect: "`redirect("/jobs")` in a loader, or a component that navigates".

Observed: the loader form makes `pnpm build:worker` fall back. The Cloudflare build renders `/`
through the React Router handler to produce `dist/index.html`
(`writeCloudflarePagesStaticShell` in `dist/deploy/build.js` requests
`https://agent-native.local/` with `X-React-Router-SPA-Mode: yes`), and a redirecting root
returns no HTML, so its assertion fails:

```
Error: React Router did not render a usable Cloudflare Pages static shell
[deploy] React Router static shell render failed; using manifest fallback. ...
[deploy] Wrote Cloudflare Pages static app shell fallback.
```

The build still exits 0 and the framework writes a manifest-generated shell, so this is a
degradation rather than a failure. With the component form the line is
`[deploy] Wrote Cloudflare Pages static app shell.` again, identical to T02.

Impact: T03 step 10 only — the choice between the two forms the step offers.

Proposed handling: used the component form, `<Navigate to="/jobs" replace />` in
`app/routes/_index.tsx`, with a comment recording why. Note for T12 and T14: the deployed Worker
serves `dist/index.html` for `/` as a static asset before the Worker runs, so `/` is a
client-side redirect there whichever form is used; a Worker smoke test must not expect an HTTP
302 from `/`.

Resolution: 2026-09-06 — F7 and B19 updated: client-side `<Navigate>` at `/`; never expect a 302 from `/`.
## 2026-09-06 T03 — `validateEnvironment(env)` cannot implement B13's "APP_ENV missing → error on Workers"

Expected (plan reference): `docs/plan/03-blueprint.md` B13 ("`APP_ENV` missing → treated as
`local` on the Node dev server, error on Workers") and `docs/plan/tasks/T03-framework-config.md`
step 8 plus the Acceptance note, which fix both the signature
(`validateEnvironment(env: Record<string, string | undefined>): string[]`) and the exact list of
thirteen variables the plugin may read.

Observed: those two requirements cannot both hold. The mandated input is thirteen named
variables, none of which distinguishes a Worker from the Node dev server — `NODE_ENV`, the one
value that would (B13 has it unset locally and `"production"` on every Worker), is not on the
list, and the runtime signals that would (`globalThis.__cf_env`, per F8) are not environment
variables at all.

Impact: T03 step 8, one rule out of the B13 set. Every other B13 rule is implemented.

Proposed handling: `resolveEnvironmentClass` treats a missing `APP_ENV` as `local`, which is
B13's Node-dev-server half, and an `APP_ENV` that is set but is not one of the four classes is
reported as a violation (so a typo such as `prod` fails loudly rather than silently selecting
the local rules). The Workers half is unreachable from our own configuration: `wrangler.jsonc`
sets `APP_ENV` in `vars` for the default, `staging` and `production` environments, and
`scripts/check-config-hygiene.mjs` parses that file. If the maintainer wants the rule enforced
anyway, the smallest change is to add `NODE_ENV` to the plugin's read list and treat
"`APP_ENV` unset and `NODE_ENV=production`" as a violation.

Resolution: 2026-09-06 — B13 rewritten: missing `APP_ENV` resolves to `local`; unknown value is a violation.
## 2026-09-06 T05 — B7's `ports.ts` step and B22's own file path for `ExternalAccountingSystem` disagree

Expected (plan reference): `docs/plan/tasks/T05-application-core.md` step 4 ("`src/application/ports.ts` per B7 (all interfaces, `Dependencies`)") and the Deliverables list, which names only
`src/application/ports.ts` (no subdirectory). `docs/plan/03-blueprint.md` B7's own code block,
however, annotates the `ExternalAccountingSystem` interface with a trailing comment
`// src/application/ports/external-accounting.ts`, and B22 repeats this explicitly: "Files:
`src/application/ports/external-accounting.ts` (port + `ExternalSystemError`)".

Observed: step 4's instruction ("all interfaces … in ports.ts") and B7/B22's own file
annotation for one of those interfaces name two different locations for the same type.

Impact: T05 step 4 only, and the "git diff --stat shows only listed deliverables" acceptance
rule in `docs/plan/tasks/README.md` — one extra file, `src/application/ports/external-
accounting.ts`, is not on the Deliverables list.

Proposed handling: followed B22's explicit file path, since T27 (which the same task file
told this task to read B22 for) will need `ExternalSystemError` and depends on this exact
location. `src/application/ports/external-accounting.ts` exports `ExternalAccountingSystem`
and `ExternalSystemError`; `src/application/ports.ts` re-exports both with `export * from
"./ports/external-accounting"` and imports the interface type for use in `Dependencies`, so
every other file can still do `import { ExternalAccountingSystem, Dependencies, ... } from
"../application/ports"` as step 4 implies. `tests/fixtures/in-memory.ts` implements a trivial
in-memory `ExternalAccountingSystem` (deterministic `ACC-<jobId>` reference, an `alreadyExisted`
flag keyed by idempotency key, no `failNextCall`) so `Dependencies` is complete for every
use-case test before T27 adds the real, independently tested mock adapter.

Resolution: 2026-09-06 — Accepted: the port lives in `src/application/ports/external-accounting.ts` and `ports.ts` re-exports it.
## 2026-09-06 T06 — a naively generated `migrations-manifest.ts` fails `oxfmt --check`

Expected (plan reference): `docs/plan/tasks/T06-schema-migrations.md` step 4 —
`scripts/gen-migrations-manifest.mjs` "writes `src/infrastructure/migrations-manifest.ts`
containing `export const MIGRATION_FILES = [ ...sorted names ] as const;` … Commit the
generated file" — together with the standing rule that `pnpm check` (which runs
`oxlint . && oxfmt --check .`) passes.

Observed: the two requirements collide. oxfmt 0.66.0 has an opinion about array layout: with
one migration it collapses the emitted

```ts
export const MIGRATION_FILES = [
  "0001_init.sql",
] as const;
```

onto one line, so immediately after `node scripts/gen-migrations-manifest.mjs` (or after any
`pnpm db:migrate` / `pnpm build:worker`, both of which run the generator) `pnpm lint` reports
`src/infrastructure/migrations-manifest.ts … Format issues found in above 1 files`. Emitting
the single-line form instead only moves the problem: with the second migration (T27's
`0002_job_accounting.sql`) the line is 84 characters, over the repository's
`printWidth: 80`, and oxfmt expands it again.

Impact: T06 step 4, and `pnpm check` after any command that regenerates the manifest.

Proposed handling: the generator writes the file and then runs the repository's own formatter
on it (`node_modules/.bin/oxfmt --write <file>`) when that binary is present, so the committed
file matches `.oxfmtrc.json` for any number of migrations rather than duplicating oxfmt's
line-breaking rule in the generator. Verified idempotent at one and at three migration files.
A production-only install has no oxfmt; the generator then leaves its own valid-TypeScript
output in place and says so. Note for T27: adding `0002_job_accounting.sql` changes this file
from one line back to three, which is expected.

Resolution: 2026-09-06 — Accepted; the generator formats its output with the repository's oxfmt.
## 2026-09-06 T07 — `getDbExec()` advertises both `atomicBatch` and `transaction` until its first query

Expected (plan reference): `docs/plan/02-framework-facts.md` F8 ("On D1: `atomicBatch` present,
`transaction` absent. On the local file (better-sqlite3) and libsql: `transaction` present
(BEGIN IMMEDIATE), `atomicBatch` absent") and `docs/plan/03-blueprint.md` B11's `runAtomic`
("if `exec.atomicBatch`: use it; else if `exec.transaction`: run sequentially inside it").

Observed: F8 describes the executor **after** it has initialised. `getDbExec()` returns a lazy
proxy (`node_modules/@agent-native/core/dist/db/client.js:1851`) that defines `execute`,
`transaction` *and* `atomicBatch` up front and only replaces the unsupported one with
`undefined` when its first `execute()` has chosen a driver. With
`DATABASE_URL=file:./data/probe.db`:

```
pre-init:  { execute: 'function', transaction: 'function', atomicBatch: 'function' }
post-init: { transaction: 'function', atomicBatch: 'undefined' }
```

So a `runAtomic` that feature-detects on a freshly obtained executor sends a local-file write
down the `atomicBatch` path, which throws `This database does not support atomic batches.`
(verified). Calling it again does not help: the failed call leaves `atomicBatch` still defined
on the proxy. In practice the first database call of a request is the membership lookup in
`resolveActor`, which would hide this — until the first process where a write happens to come
first, such as a seed script or an integration test.

Impact: T07 steps 2 and 4 (`runAtomic` and every repository).

Proposed handling: `runAtomic` is exactly B11's three-branch rule and is unchanged. The
repositories reach their executor through `resolveExec` (`src/infrastructure/d1/atomic.ts`),
which issues one throwaway `SELECT 1` when — and only when — an executor advertises both
capabilities, since a real one never does. `tests/integration/repositories.test.ts` exercises
this: its first database call is a `create`, which fails without the workaround. Suggest F8
gains a sentence about the pre-initialisation shape.

Resolution: 2026-09-06 — F8 updated; `resolveExec` probes with `SELECT 1` first.
## 2026-09-06 T07 — B11's audit-row guard lets a lost update write an operation row

Expected (plan reference): `docs/plan/03-blueprint.md` B11's `commit` batch — statement 1 the
versioned `UPDATE`, statement 2 the operation `INSERT` guarded by
`EXISTS (SELECT 1 FROM jobs WHERE org_id = ? AND id = ? AND version = ?)   -- new version`,
with the note "Statement 2's guard makes the batch a no-op when statement 1 did not apply" —
together with `docs/plan/tasks/T07-infrastructure.md` step 8, which requires that a `commit`
with a stale version "throws CONFLICT and leaves no operation row".

Observed: the guard is not sufficient, and the first run of the integration test proved it. Two
callers read `job_acme` at version 1 and both complete it. The winner writes version 2. The
loser's `UPDATE ... AND version = 1` affects zero rows as intended, but its operation insert is
guarded on the version *it* wanted to write — also 2 — which now matches the winner's row, so
the guard passes and an audit row is written for a change that never happened:

```
AssertionError: expected { id: 'op_stale_job_acme', …(15) } to be null
+ Received: { "action": "complete-job", "versionBefore": 1, "versionAfter": 2, … }
```

The same batch's optional third statement, `MARK_OPERATION_UNDONE` as B11 spells it, has no
guard at all, so a refused commit would still mark an earlier operation undone by an audit row
that was never inserted.

Impact: T07 steps 1, 2 and 4, and the correctness of the undo history every later task reads.

Proposed handling: same statements, corrected guards. The operation insert now runs **first**
and is guarded on the version the caller read (`expectedVersion`), which is the same predicate
the update carries; both statements see the same pre-image inside one transaction, so they
apply together or not at all whatever version the update would have written.
`MARK_OPERATION_UNDONE` gained `AND EXISTS (SELECT 1 FROM operations WHERE org_id = ? AND
id = ?)` naming the undoing operation, so it cannot outlive a batch whose guards failed. The
CONFLICT decision now reads both counts (`affected[0] !== 1 || affected[1] !== 1`) rather than
B11's `rowsAffected[0]`, because index 0 is no longer the update. Both cases are covered in
`tests/integration/repositories.test.ts`. Suggest B11 is rewritten to this shape.

Resolution: 2026-09-06 — B11 rewritten to the verified shape (operation insert first, both row counts checked).
## 2026-09-06 T07 — "every exported constant contains `org_id = ?`" cannot hold for the WHERE fragments

Expected (plan reference): `docs/plan/tasks/T07-infrastructure.md` step 1 — "Every constant
except `SELECT_MEMBER_ROLE` contains `org_id = ?`" and, in the same paragraph, "`SELECT_JOBS`
supports optional filters by building the WHERE clause in code from a fixed set of fragments
(status, customer_id, scheduled_at >= ?, scheduled_at < ?) — the fragments are also exported
constants" — with step 6's test: "iterate every exported string, assert it contains
`org_id = ?`".

Observed: the two cannot both be true. A fragment is ` AND status = ?`; it has no `org_id` of
its own and cannot have one, because it is appended to a statement that already carries the
predicate. Exporting the fragments as loose string constants would make step 6's test fail on
statements that are correct.

Impact: T07 steps 1 and 6.

Proposed handling: the fragments are exported, but grouped in one frozen record per list
statement (`SELECT_JOBS_PARTS`, `SELECT_CUSTOMERS_PARTS`) rather than as loose strings, so
"every exported string" still means "every whole statement" and step 6's assertion holds
unweakened for all 18 of them. `tests/unit/infrastructure/sql-scoping.test.ts` checks the
fragments too, against the stricter rule that actually applies to them: each must match a fixed
`AND <column> <operator> ?` / `ORDER BY …` pattern with at most one placeholder, so no caller
value can ever reach the SQL text. `SELECT_CUSTOMERS` needed the same treatment as
`SELECT_JOBS`; step 1 only mentions the latter, but `CustomerRepository.list` takes `status`
and `search` filters (B7).

Resolution: 2026-09-06 — B11 updated: `*_PARTS` records and a fixed allow-list for fragments.
## 2026-09-06 T07 — the in-memory `to` filter is inclusive, the SQL fragment T07 specifies is exclusive

Expected (plan reference): `docs/plan/tasks/T07-infrastructure.md` step 1 lists the job filter
fragments as "(status, customer_id, scheduled_at >= ?, scheduled_at < ?)", i.e. a half-open
window.

Observed: `tests/fixtures/in-memory.ts` (T05), which the same ports are implemented against and
which every use-case unit test runs on, filters with
`.filter((j) => (filter.to ? j.scheduledAt <= filter.to : true))` — inclusive. A job scheduled
exactly at `to` is returned by the in-memory repository and not by the D1 one.

Impact: no T07 step fails; the difference only surfaces in T08, whose `list-jobs` use case is
unit-tested against the in-memory repository and integration-tested against this one.

Proposed handling: followed the task file, which is normative for T07 — `SELECT_JOBS_PARTS.to`
is `AND scheduled_at < ?`. `tests/fixtures/in-memory.ts` was left untouched because it is a T05
deliverable and this task's scope rule forbids editing it. T08 should either change that one
character in the fixture (making both half-open, which is what a day or week filter wants) or
record the inclusive form in B7; the two implementations of one port must not stay divergent.

Resolution: 2026-09-06 — T08 step 4 changed `tests/fixtures/in-memory.ts` to
`j.scheduledAt < filter.to`. Both implementations are now half-open, and
`ListJobsInput` in `src/application/use-cases/list-jobs.ts` documents it.

## 2026-09-06 T07 — the container has to fill `Dependencies.accounting`, which no task before T27 provides

Expected (plan reference): `docs/plan/tasks/T07-infrastructure.md` step 5 lists the container's
job as `getDependencies(): Dependencies` and names no accounting adapter;
`docs/plan/03-blueprint.md` B7 makes `accounting: ExternalAccountingSystem` a required field of
`Dependencies`, and B22 gives the real mock adapter
(`src/infrastructure/mock/mock-accounting.ts`) to T27.

Observed: `getDependencies()` cannot type-check without an `accounting` value, and T07 is not
asked to build one.

Impact: T07 step 5 only.

Proposed handling: `container.ts` fills the field with a four-line adapter that throws
`ExternalSystemError("The accounting system is not configured")`. Nothing calls it before T27
adds `send-job-to-accounting`, and refusing loudly in the port's own error type is safer than a
stub that returns a plausible invoice reference. T27 replaces the constant with the real mock
adapter.

Resolution: 2026-09-06 — T27 updated: replace the placeholder adapter that throws `not configured`.
## 2026-09-06 T08 — `actions/run.ts` is the CLI dispatcher, and deleting it broke `pnpm action`

Expected (plan reference): `docs/plan/03-blueprint.md` B16 ("`hello.ts` and `run.ts` are
deleted") and `docs/plan/tasks/T03-framework-config.md` step 6, whose acceptance asserts
`test ! -e actions/run.ts`. `docs/plan/02-framework-facts.md` F13 at the same time promises
`pnpm action <name> '{"arg":"value"}'` as a working surface, and T08's acceptance runs
`pnpm action list-jobs --help`.

Observed: with `actions/run.ts` absent,

```
$ pnpm action list-jobs --help
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'/Users/.../agent-native-cloudflare-starter/scripts/run.ts' imported from ...
```

`node_modules/@agent-native/core/dist/cli/index.js` (case `"action"`, lines 697-710) resolves
`actions/run.ts`, falls back to `scripts/run.ts`, and executes whichever exists. The scaffolded
file is two lines — `import { runScript } from "@agent-native/core/scripts"; void runScript();`
— i.e. the CLI's dispatcher entry point, not a demo action. F5 already records that a file named
`run` is skipped by action discovery, so it never was an action.

Impact: T08's second acceptance command, and every later task or document that uses
`pnpm action <name>` (F13, B15).

Proposed handling: restored `actions/run.ts` byte-for-byte from the scaffold commit
(`git show e9e68a4:actions/run.ts`). Verified that it does not become an action: after deleting
`.generated/` and re-running `pnpm dev`, `actions-registry.ts` still lists exactly the seven app
actions and no `run`. T03's `test ! -e actions/run.ts` assertion is now false; B16's sentence
should be narrowed to `hello.ts`, and T03's acceptance line dropped.

Resolution: 2026-09-06 — F5 and B16 updated: `run.ts` stays; T03's acceptance line is superseded.
## 2026-09-06 T08 — `pnpm action <name> --help` runs the action instead of printing its parameters

Expected (plan reference): `docs/plan/tasks/T08-queries.md` acceptance,
`pnpm action list-jobs --help  # prints the action's parameters`.

Observed: with `actions/run.ts` restored (entry above), `--help` after an action name is parsed
as an ordinary argument. `dist/scripts/parse-args.js` turns `--help` into `{ help: "true" }`,
`dist/scripts/runner.js` handles `--help` only when it appears *instead of* an action name
(`if (!actionName || actionName === "--help")`), and `dispatchAction` then calls the action's
wrapped `run`. So the command runs the query:

```
$ pnpm action list-jobs --help
{"level":"error","event":"action","action":"list-jobs","outcome":"error","errorCode":"AUTHENTICATION","caller":"cli","orgId":null,"durationMs":0}
Action "list-jobs" failed: Sign in required
```

(`AUTHENTICATION` because the CLI has no identity until `AGENT_USER_EMAIL` / `AGENT_ORG_ID` are
set; with them the action runs and prints `[]`.) The runner's own banner text — "Run any action
with --help for usage details" — is not implemented for `defineAction`-style local actions in
0.176.5.

Impact: T08's second acceptance command cannot pass as written. The same line is likely to be
copied into T09, T10 and T27.

Proposed handling: the two commands that do print the parameter list were run and their output
recorded in the pull request instead:

- `pnpm action --help` lists every app action by name.
- Any call that fails schema validation prints the full signature, e.g.
  `pnpm action list-jobs --status nope` →
  `Invalid action parameters — status: … Expected: { status?: "scheduled"|"in_progress"|"completed"|"archived", customerId?: string, from?: string, to?: string, includeArchived?: boolean } (where * = required, ? = optional).`

The acceptance line should become one of those two, in this task file and in the later ones.

Resolution:

## 2026-09-06 T08 — the in-memory repositories return rows unordered; the D1 ones order them

Expected (plan reference): `docs/plan/03-blueprint.md` B7 gives one `list` signature per
repository and says nothing about ordering; T07 chose `ORDER BY scheduled_at ASC, id ASC`
(`SELECT_JOBS_PARTS.order`) and `ORDER BY name ASC, id ASC`
(`SELECT_CUSTOMERS_PARTS.order`) in `src/infrastructure/d1/sql.ts`.

Observed: `tests/fixtures/in-memory.ts` returns `Array.from(map.values()).filter(...)`, i.e.
insertion order, for both `customers.list` and `jobs.list`. A `listJobs` unit test that asserted
`scheduled_at` order passed against D1 and failed against the fixture. (`operations.listRecent`
and `listForResource` do sort, so only the two `list` methods diverge.)

Impact: no acceptance command fails. `tests/unit/application/queries.test.ts` cannot assert
ordering, so it asserts sets (its `ids()` helper sorts) and carries a comment pointing here.

Proposed handling: left both implementations as they are — T08 was asked to reconcile the `to`
filter only — and recorded it. The fix is three lines in the fixture (sort by `scheduledAt`
then `id`, and by `name` then `id`); a task that needs order-sensitive unit tests, or T15's
integration suite, should make it.

Resolution: 2026-09-06 — T11 updated: in-memory repositories sort like the D1 adapters.
## 2026-09-06 T08 — B9's "creates are never redone" cannot be evaluated from resource versions

Expected (plan reference): `docs/plan/tasks/T08-queries.md` step 2 —
`redoable` "computed with `canUndo` and the redo rule from B9 against the current resource
versions — load each distinct resource once". B9's redo rule has three parts: the operation is
an undo that has not itself been reverted (1), the resource is still at `undoOp.versionAfter`
(2), and the original forward operation was not a create, because "creates are never redone
(their undo is a compensation): INVARIANT" (3).

Observed: parts 1 and 2 are properties of the operation row and the resource version. Part 3 is
a property of a *different* row — the forward operation at `undoOp.relatedOperationId` — which
is not necessarily inside the page `listRecent` returned, and loading it per undo operation is
the N+1 the same sentence forbids.

Impact: `listRecentActivity` in `src/application/use-cases/list-recent-activity.ts`. An undo of
a `create-customer` or `create-job` is reported `redoable: true`; `redo-operation` (T10) will
refuse it with INVARIANT.

Proposed handling: implemented parts 1 and 2 only, with the flag documented in the use case as
an affordance rather than an authority (T10's `redoOperation` re-checks everything). If the
false positive matters to the UI, the cheapest fix is a `payload` or `classification` on the
undo row that records whether its forward operation was a create, written by T10 where the
forward operation is already loaded.

Resolution: 2026-09-06 — T10 updated: `redoable` is false when the related forward operation is a create (`versionBefore === 0`).
## 2026-09-06 T08 — the generated registry is `actions-registry.ts`, not `.js`

Expected (plan reference): `docs/plan/02-framework-facts.md` F12,
"`.generated/actions-registry.js` is produced by the framework build/dev step from `actions/`".

Observed: `pnpm dev` writes `.generated/actions-registry.ts` and `.generated/action-types.d.ts`;
no `.js` file is produced. `server/plugins/agent-chat.ts` imports
`"../../.generated/actions-registry.js"` and works, because that is the TypeScript ESM
convention for importing a `.ts` module.

Impact: none observed — the import specifier the scaffold uses is correct as written. Recorded
so a later task does not go looking for a file that is never written.

Proposed handling: none; F12's file name should read `.ts`.

Resolution: 2026-09-06 — F12 updated.
## 2026-09-06 T09 — an idempotent create's replay can only find its own operation row through a bounded query

Expected (plan reference): `docs/plan/03-blueprint.md` B8's last paragraph — "before building
the resource, `deps.idempotency.find(orgId, action, key)`; when it returns an id, load and
return that resource with `operationId` of its creating operation (query `listForResource` and
take the `forward` create op)".

Observed: `listForResource` cannot be asked for the create op. `OperationRepository`
(`docs/plan/03-blueprint.md` B7) is
`listForResource(orgId, type, id, limit): Promise<Operation[]>` — `limit` is required, there is
no filter by `action` or `kind`, and both implementations return the *newest* rows first
(`SELECT_OPERATIONS_FOR_RESOURCE` in `src/infrastructure/d1/sql.ts` is
`ORDER BY performed_at DESC, id DESC LIMIT ?`; `tests/fixtures/in-memory.ts` sorts the same
way). The creating operation is the oldest row for its resource, so a replay finds it only
while the resource has fewer than `limit` operations. No other route exists: `idempotency_keys`
stores `resource_id` and not the operation id (B10), and `CommandResult` requires one
(B8).

Impact: T09 step 1, the idempotent creates only. Nothing else reads a create's operation id.

Proposed handling: `CREATE_OPERATION_LOOKUP_LIMIT = 100` in
`src/application/use-cases/command.ts`, with the reasoning next to it. A replay is a retry of a
call that just happened, so in practice the create is the only operation on the resource; the
verification transcript shows a replayed `create-customer` returning the first call's
`operationId` with no second row written. A key whose resource has since accumulated more than
100 operations is reported as `AppError("INTERNAL", "Unexpected error")` — the create is not
repeated and no wrong operation id is returned. Making it exact needs a new port method
(`findCreateOperation(orgId, type, id, action)`, one statement:
`... AND kind = 'forward' AND action = ? ORDER BY performed_at ASC LIMIT 1`), which is a B7
decision rather than this task's.

Resolution: 2026-09-06 — B7 gains `OperationRepository.findCreateOperation(orgId, resourceType, resourceId)`; T10 implements it in both repositories and removes the bounded lookup from `command.ts`.