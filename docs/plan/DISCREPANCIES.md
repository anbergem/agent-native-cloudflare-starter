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

Resolution:

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

Resolution:

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

Resolution:

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

Resolution:

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

Resolution:

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

Resolution:
