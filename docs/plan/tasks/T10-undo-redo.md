# T10 — Undo and redo

Goal: `undo-operation` and `redo-operation` as audited actions implementing B9 exactly.

Depends on: T09. Read: B4 (`canUndo`), B9, B16; D13.

## Steps

1. `src/application/use-cases/undo-operation.ts` and `redo-operation.ts` per B9. Error
   messages exactly as listed there.
2. Actions `actions/undo-operation.ts` (`{ operationId }`, description: "Undo a previous
   operation when no newer change exists. Refuses with CONFLICT if the record changed since.")
   and `actions/redo-operation.ts` (`{ operationId }` of an undo operation), both
   `mcpTool: true`, audit target from the loaded operation's resource (`audit.target` receives
   `(args, result)`; use `result.resource` type/id).
3. Tests `tests/unit/application/undo.test.ts`: undo of each forward action restores the exact
   previous fields; undo of a create archives the resource; the B9 concurrency scenario;
   `already-undone`, `irreversible` (set a classification manually in state), `not-forward`;
   redo after undo re-applies and marks the undo op; redo refused when the resource moved on;
   redo of a create's undo is INVARIANT; undo/redo operations appear in `list-recent-activity`
   with `kind` set.
4. Verify on the Node dev server: complete a job via curl, undo via curl (status back, version
   + 1), redo via curl; `list-audit-events` shows `undo-operation` and `redo-operation` rows.

## Deliverables

Two use cases, two actions, `tests/unit/application/undo.test.ts`.

## Acceptance

```bash
pnpm check
```
plus the step 4 transcript.
