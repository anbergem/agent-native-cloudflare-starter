# Repository settings

Protect `main` with pull requests. Require the `CI / verify` and `CI / worker` checks, block force pushes and direct pushes, and require branches to be current before merge when that is practical. Linear history is optional.

Create a `staging` environment with `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `SEED_PASSWORD` secrets and a `STAGING_URL` variable. Staging does not need required reviewers because it deploys only a successful same-repository CI commit from `main`.

Create a `production` environment with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets and a `PRODUCTION_URL` variable. Configure required reviewers so artifact promotion cannot start without human approval.

Create a separate `production-backup` environment without required reviewers. Give its Cloudflare token account-scoped `D1 Read`, the minimum documented D1 read permission. That permission is not restricted to one database, so use a dedicated Cloudflare account where database-level credential isolation is required. Configure optional `BACKUP_AGE_RECIPIENT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_ACCESS_KEY_ID`, and `BACKUP_S3_SECRET_ACCESS_KEY` secrets plus `BACKUP_S3_REGION` and `BACKUP_S3_PREFIX` variables. This separation lets scheduled exports run while keeping production deployment approval intact.

Enable the repository's template flag and install the Renovate GitHub App. Keep the default `GITHUB_TOKEN` permission read-only; individual workflows declare only the additional read access they need.

Framework upgrades are never automerged because generated Worker output and the compatibility patch must be exercised together. Review also verifies migrations, authenticated actions, approval behavior, and organization isolation before staging receives the change.
