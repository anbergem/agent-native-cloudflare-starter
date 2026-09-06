# T24 — Bootstrap checklist and rename script

Goal: the post-template checklist from spec section 43 as `docs/bootstrap.md`, with exact
commands, and a rename script.

Depends on: T23. Read: F10; B14; D04, D11, D15, D18.

## Steps

1. `scripts/rename-app.mjs --name <kebab> --display "<Display Name>"`: replaces
   `example-jobs` with the kebab name and `Example Jobs` with the display name in
   `package.json` (`name`), `wrangler.jsonc`, `server/plugins/config.ts`,
   `server/plugins/auth.ts`, `server/plugins/agent-chat.ts`, `README.md`, `docs/**/*.md`,
   `scripts/*.mjs`, `scripts/*.sh`, `.github/workflows/*.yml`; prints every file changed;
   refuses names that are not `^[a-z][a-z0-9-]{2,40}$`.
2. `docs/bootstrap.md`: numbered steps 1–17 from the spec, each with the exact command or
   click path and the expected result, including: `wrangler login`; `wrangler d1 create
   <name>-staging --jurisdiction eu` and `-production`; paste ids into `wrangler.jsonc`;
   `wrangler secret put` for each secret per environment (list them); Google Cloud OAuth client
   creation with the redirect URIs for staging and production and the consent screen set to
   internal; GitHub environments and variables (`STAGING_URL`, `PRODUCTION_URL`); Renovate app;
   backup destination variables; first `pnpm db:migrate:staging`; first
   `pnpm deploy:staging`; creating the first organization and owner (sign in with Google once
   with `AUTO_CREATE_DEFAULT_ORG=0`, then run `pnpm action` ... — specify the exact procedure:
   a one-off script `scripts/bootstrap-org.mjs --env <env> --name "<Org>" --owner <email>` that
   inserts the organization and owner membership through `wrangler d1 execute --remote`; write
   that script too); enabling "require Google sign-in" in the Team page; the first production
   run through the workflow; a final checklist of things to delete (sample data, `nb-NO` review
   marker) or keep.
3. Every command in the document must be copy-pasteable and use `<placeholders>` only where a
   value is customer-specific.

## Deliverables

`scripts/rename-app.mjs`, `scripts/bootstrap-org.mjs`, `docs/bootstrap.md`.

## Acceptance

```bash
pnpm check
git stash -u && node scripts/rename-app.mjs --name acme-ops --display "Acme Ops" && git diff --stat && git checkout -- . && git stash pop
```
(the diff must touch only the files listed in step 1 and `pnpm check` must still pass on the
renamed tree before reverting).
