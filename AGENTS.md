# AGENTS.md — instructions for coding agents working in this repository

This repository is being built from a written implementation plan. Preserve its product
intent and architectural boundaries; verify implementation details against evidence. Before you do anything else:

1. Read `docs/plan/README.md`. It explains how work is organised, how to pick a task,
   and the rules you must follow.
2. Read the task file you were assigned under `docs/plan/tasks/`. Deliver its intended behavior and acceptance checks.
3. Read the sections of `docs/plan/02-framework-facts.md` and `docs/plan/03-blueprint.md`
   that the task file lists. They contain verified facts about the framework and the exact
   shapes of the code you must produce.

Hard rules that apply to every task:

- Do not invent framework APIs. Every framework symbol you use must appear in
  `docs/plan/02-framework-facts.md` or in the version-matched docs and type definitions
  under `node_modules/@agent-native/core/` (see the facts file for how to search them).
- If reality differs from the plan, record the evidence and resolution in
  `docs/plan/DISCREPANCIES.md`, make the smallest correction that preserves the approved
  behavior, and update every affected blueprint/task instruction in the same change.
  Escalate changes to product scope, security policy or deployment architecture; ordinary
  implementation corrections do not need a separate future task.
- Never commit secrets. `.env`, `.dev.vars` and `.dev.vars.*` are git-ignored; only the
  `*.example` files are committed and they contain names, never values.
- Never touch a Cloudflare, Google or GitHub production resource from a task.
- Every task ends with the acceptance commands listed in the task file passing. Paste their
  output into the pull request.

The final version of this file is produced by task T23. Until then, this bootstrap version is
authoritative.
