# T20 — Production deployment workflow

Goal: `.github/workflows/deploy-production.yml` implementing artifact promotion, Time Travel
bookmark, migrations, deploy, and the read-only production smoke.

Depends on: T19. Read: F10; B19, B20; D21.

## Steps

1. Write `deploy-production.yml`: `workflow_dispatch` with inputs `staging_run_id` (required,
   string) and `confirm` (required, string, must equal `deploy`); job `promote` with
   `environment: production` (required reviewers are configured by the maintainer), permissions
   `contents: read, actions: read`; steps: verify `inputs.confirm == 'deploy'`; checkout;
   pnpm/node setup; install (needed for wrangler); download the artifact:
   `gh run download ${{ inputs.staging_run_id }} --name worker-bundle-<sha> --dir dist`
   where `<sha>` is resolved with `gh run view ${{ inputs.staging_run_id }} --json headSha -q .headSha`;
   verify `jq -r .sha dist/BUILD_INFO.json` equals that sha and equals the checked-out commit
   (`git rev-parse HEAD`), else fail; record
   `pnpm exec wrangler d1 time-travel info example-jobs-production --env production --json`
   into `$GITHUB_STEP_SUMMARY`; `pnpm db:migrate:production`; `pnpm deploy:production`;
   `node scripts/worker-smoke.mjs --base-url ${{ vars.PRODUCTION_URL }} --mode production`;
   on failure append to the summary: the bookmark, the previous deployment id from
   `wrangler deployments list --env production`, and the rollback command
   `wrangler rollback --env production`.
2. Ensure `pnpm deploy:production` does not rebuild: `wrangler deploy` uses `dist/` as
   downloaded; add a guard step that fails if `dist/_worker.js/PATCHED.json` is missing.
3. Validate with `actionlint` and a dry run as in T19.

## Deliverables

`.github/workflows/deploy-production.yml`.

## Acceptance

```bash
pnpm check
npx actionlint@latest .github/workflows/deploy-production.yml
```
plus the dry-run transcript.
