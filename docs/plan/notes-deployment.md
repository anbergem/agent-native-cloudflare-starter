<!-- Working notes for T19–T22. T23 folds these into docs/deployment.md and docs/runbook.md. -->

## Secrets and variables per GitHub environment

- Staging secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `SEED_PASSWORD`.
- Production secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. No `SEED_PASSWORD`: production is never seeded (B13, AGENTS.md).
- Grant the deployment Cloudflare token Workers Scripts:Edit, D1:Edit, and Workers Routes:Edit.
- Staging variable: `STAGING_URL`; production variable: `PRODUCTION_URL`. Both are the origin the smoke script calls; `wrangler.jsonc` carries the matching `APP_URL` per environment.
- Protect the `production` GitHub environment with required reviewers.
- Use a separate `production-backup` environment without required reviewers so scheduled exports can run unattended. Give its Cloudflare token account-scoped `D1 Read`, the minimum documented D1 read permission. This permission is account-scoped rather than restricted to one database, so use a dedicated Cloudflare account where stronger database isolation is required.
- Worker secrets (`BETTER_AUTH_SECRET`, `OAUTH_STATE_SECRET`, `GOOGLE_SIGN_IN_CLIENT_ID`, `GOOGLE_SIGN_IN_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, staging `SEED_PASSWORD`) are set per environment with `wrangler secret put`, not through GitHub. GitHub only holds what the workflows themselves need.

## Staging (`deploy-staging.yml`)

- Triggered by `workflow_run` on the `CI` workflow completing on `main`, plus `workflow_dispatch`.
- Staging deploys only a SHA with a successful same-repository `CI` run on `main`; manual staging dispatch is restricted to `main` and performs the same exact-SHA CI lookup.
- Each staging run publishes an immutable deployment manifest containing the actual deployed SHA and its source CI run id. GitHub's staging workflow-run `head_sha` is not used as promotion provenance because it can describe the workflow's default-branch context rather than the triggering CI commit.
- Order of operations: validate the CI run, write the manifest, install, `pnpm build:worker`, upload `worker-bundle-<sha>` and `deployment-manifest` (90-day retention), `pnpm db:migrate:staging`, `pnpm deploy:staging`, reset the QA scenario, then the staging smoke as the QA owner.
- The seed reset runs `--target d1-remote --env staging --reset --base-url "$STAGING_URL"`; the script refuses `--env production` and any base URL containing "production".
- The job summary records the deployed commit, the source CI run, the artifact name, and the deploy/smoke status.
- Migrations run before the deploy, so every migration must be backwards compatible with the Worker version still serving traffic.

## Production (`deploy-production.yml`)

- Manual `workflow_dispatch` only, with inputs `staging_run_id` and `confirm` (must be the literal `deploy`); the job also requires `github.ref == refs/heads/main`.
- Production dispatch is restricted to `main`. It accepts a numeric staging run id, validates the staging workflow/repository/branch/status/conclusion, validates the manifest's exact source CI run, checks out the manifest SHA, and deploys its verified artifact without rebuilding.
- The manifest SHA is what gets checked out, so migrations, the lockfile, the Wrangler configuration and the tool versions all come from the promoted commit.
- `scripts/verify-promotion-artifact.mjs` fails the promotion unless `dist/BUILD_INFO.json` names that SHA, the checked-out `HEAD` is that SHA, and `dist/_worker.js/PATCHED.json` matches the SHA-256 of the downloaded `index.js`. A missing `PATCHED.json` is a hard failure, so an unpatched bundle cannot reach production (D03).
- Inputs never reach shell code unchecked: the run id is validated as digits, and every value is passed through an environment variable.
- A non-cancelling `deploy-production` concurrency group serialises promotions; a queued promotion waits rather than replacing the running one.
- Before migrating, the job records `wrangler d1 time-travel info example-jobs-production --env production --json` and `wrangler deployments list --env production --json` into the job summary. On failure it appends the bookmark, the previous deployments and both rollback commands (`wrangler rollback <version-id> --env production`, and `wrangler d1 time-travel restore` only if a migration corrupted data).
- The production smoke is read-only: no login, no writes, no agent chat (B19).

## Backups (`backup-d1.yml`, T21)

- Daily at 03:00 UTC plus manual dispatch, in the `production-backup` environment, always from `refs/heads/main`.
- Configure backup encryption with `BACKUP_AGE_RECIPIENT` when required; `age` is installed by the workflow only when that recipient is set.
- Set `BACKUP_AGE_IDENTITY` to the matching age identity file when running a restore check for an encrypted backup; keep that file outside the repository.
- Configure S3 backup storage with `BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, and optional `BACKUP_S3_REGION`/`BACKUP_S3_PREFIX`.
- Without S3 configuration, the backup workflow keeps a GitHub artifact for 30 days.
- `scripts/backup-d1.sh` fails the run unless the export is non-empty and contains `CREATE TABLE` and `customers`, so a silently empty dump cannot pass as a backup.
- Restore is always into a new database, never in place (D23). `scripts/restore-d1-check.sh` is the test restore and uses an isolated `--persist-to` directory, so it never touches `.wrangler/state` or any remote database. Retention lives in the destination bucket's lifecycle rules, not in this repository.
- `docs/backups.md` carries the full strategy, coverage, verification and restore procedure.

## Repository configuration (T22)

- `renovate.json` groups the framework packages, never automerges them, and holds them for three days; `docs/upgrade-playbook.md` is the manual procedure; `docs/repository-settings.md` lists branch protection, environments and the Renovate app.
- Every framework upgrade must exercise a real Worker action flow (`pnpm verify:worker`), not only the patch match count (D27).
