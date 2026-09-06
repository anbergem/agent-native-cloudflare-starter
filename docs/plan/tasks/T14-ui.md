# T14 — User interface

Goal: the minimal, usable UI from B17 on top of the scaffold's shell, calling only actions.

Depends on: T10. Read: F4 (client imports), F5 (client hooks); B2 (ui rules), B17; D08.

## Steps

1. Routes (`app/routes/`): `jobs.tsx` (list + status filter + "New job" dialog), `jobs.$id.tsx`
   (detail with Start, Complete, Reschedule, Archive and the job's operation list from
   `list-recent-activity` with `resourceType: "job", resourceId`), `customers.tsx` (list +
   "New customer" dialog + archive button), `customers.$id.tsx`, `activity.tsx` (recent
   operations with Undo/Redo buttons using the `undoable`/`redoable` flags); keep `team.tsx`,
   `settings*.tsx`, `observability.tsx`, `agent.tsx`, `chat.$threadId.tsx`; make `home.tsx`
   redirect to `/jobs`. Sidebar entries: Jobs, Customers, Activity, Team, Settings.
2. Components under `app/components/jobs/`, `app/components/customers/`,
   `app/components/activity/`: forms use `react-hook-form` (present in the scaffold) with Zod
   for shape only; business rules stay server-side. Status badges; every date-time rendered
   through `useFormatters()`.
3. Mutations: `useActionMutation("<name>")`; on success invalidate the affected `list-*` and
   `get-*` queries and call `toast(<message>, { action: { label: t("common.undo"), onClick: () =>
   undo(operationId) } })`; after a successful undo, toast with a Redo action. On error show
   `t("errors." + errorCode)` when `errorCode` is present, else `actionErrorMessage(err)`.
4. Role-aware UI: `useOrgRole()` hides the archive-customer button for members; the server
   still enforces (T09).
5. Header shows `session.email` and the framework `OrgSwitcher` (keep the scaffold header if it
   already does).
6. Every user-visible string goes through `useT()`; add keys to `app/i18n/en-US.ts` (T15 adds
   `nb-NO`). No hard-coded English in components.
7. Verify manually with `pnpm db:reset && pnpm dev && pnpm db:seed`: create a customer, create a
   job for it, start, complete, undo from the toast, redo from the toast, reschedule, archive;
   the activity page lists every operation including undo/redo with kind labels; the member
   account does not see the archive-customer button; with an `ANTHROPIC_API_KEY` in `.env` the
   agent sidebar answers "list my jobs" using `list-jobs` (optional).

## Deliverables

`app/routes/*`, `app/components/{jobs,customers,activity}/*`, `app/components/layout/Sidebar.tsx`,
`app/i18n/en-US.ts`.

## Acceptance

```bash
pnpm check
pnpm build:worker
```
plus screenshots or a short transcript of step 7 in the PR.
