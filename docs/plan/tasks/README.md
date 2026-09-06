# Task index

Status values: `todo`, `in-progress (<who>)`, `blocked (<discrepancy id>)`, `done (<PR>)`.
Update this table in the same pull request that delivers the task. Pick the lowest-numbered
`todo` task whose dependencies are all `done`.

| ID | Title | Depends on | Status |
| --- | --- | --- | --- |
| T00 | Scaffold and repository baseline | — | done (PR #2) |
| T01 | Toolchain, scripts, hygiene checks | T00 | done (PR #3) |
| T02 | Worker build pipeline and Wrangler configuration | T01 | done (PR #4) |
| T03 | Framework configuration and template cleanup | T02 | done (PR #5) |
| T04 | Domain layer | T01 | done (PR #6) |
| T05 | Application core: errors, authorization, actor, ports, in-memory doubles | T04 | in-progress (Claude) |
| T06 | Schema, migrations, local migration runner, readiness route | T03, T05 | todo |
| T07 | Infrastructure: repositories, atomic writes, container | T06 | todo |
| T08 | Query use cases and actions | T07 | todo |
| T09 | Command use cases and actions | T08 | todo |
| T10 | Undo and redo | T09 | todo |
| T11 | Seed scenario and seed script | T07 | todo |
| T12 | Worker smoke script | T10, T11 | todo |
| T13 | Integration tests through the CLI surface | T10, T11 | todo |
| T14 | User interface | T10, T27 | todo |
| T15 | Internationalization | T14 | todo |
| T16 | Playwright end-to-end suite | T12, T15 | todo |
| T17 | Agent evals | T10, T11 | todo |
| T18 | CI workflow | T13, T16, T17 | todo |
| T19 | Staging deployment workflow | T18 | todo |
| T20 | Production deployment workflow | T19 | todo |
| T21 | Backups and restore | T20 | todo |
| T22 | Renovate, upgrade playbook, repository settings | T18 | todo |
| T23 | Documentation set | T21, T22 | todo |
| T24 | Bootstrap checklist and rename script | T23 | todo |
| T25 | Norwegian Bokmål upstream change (prepared for maintainer review) | T15 | todo |
| T26 | Final verification and report | T24, T25 | todo |
| T27 | External integration port and `send-job-to-accounting` | T10 | todo |

Parallelism: T04 and T05 can run in parallel with T02/T03. T11 can run in parallel with
T08–T10. T27 runs right after T10 and before T14. T14/T15 can run in parallel with T12/T13. T25 can run any time after T15.

## Common acceptance rule

Unless a task says otherwise, every task's acceptance includes `pnpm check` passing (once T01
exists) and `git diff --stat` showing only files the task lists under "Deliverables" plus
`docs/plan/tasks/README.md` and, when applicable, `docs/plan/DISCREPANCIES.md`.
