# AGENTS.md — instructions for coding agents working in this repository

This repository is being built from a written implementation plan. Nothing here is
improvised. Before you do anything else:

1. Read `docs/plan/README.md`. It explains how work is organised, how to pick a task,
   and the rules you must follow.
2. Read the task file you were assigned under `docs/plan/tasks/`. Do only what it says.
3. Read the sections of `docs/plan/02-framework-facts.md` and `docs/plan/03-blueprint.md`
   that the task file lists. They contain verified facts about the framework and the exact
   shapes of the code you must produce.

Hard rules that apply to every task:

- Do not invent framework APIs. Every framework symbol you use must appear in
  `docs/plan/02-framework-facts.md` or in the version-matched docs and type definitions
  under `node_modules/@agent-native/core/` (see the facts file for how to search them).
- If reality differs from the plan, stop the affected step, record the difference in
  `docs/plan/DISCREPANCIES.md` using the template there, and finish the rest of the task.
  Do not "fix" the plan silently and do not work around the framework silently.
- Never commit secrets. `.env`, `.dev.vars` and `.dev.vars.*` are git-ignored; only the
  `*.example` files are committed and they contain names, never values.
- Never touch a Cloudflare, Google or GitHub production resource from a task.
- Every task ends with the acceptance commands listed in the task file passing. Paste their
  output into the pull request.

The final version of this file is produced by task T23. Until then, this bootstrap version is
authoritative.
