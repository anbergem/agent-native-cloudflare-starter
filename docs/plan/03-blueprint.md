# Architecture blueprint

Sections are referenced from tasks as `B<n>`. Where this file shows code, the names, shapes
and signatures are normative. Bodies marked `/* ... */` are for the implementer to fill in
according to the surrounding text.

## B1. Repository layout (final)

```
.
├── AGENTS.md                     coding-agent instructions (T23)
├── ARCHITECTURE.md               (T23)
├── README.md                     (T23)
├── LICENSE                       MIT (exists)
├── package.json  pnpm-workspace.yaml  pnpm-lock.yaml  .nvmrc  tsconfig.json
├── agent-native.config.ts  agent-native.json  vite.config.ts  react-router.config.ts
├── vitest.config.ts  playwright.config.ts  wrangler.jsonc  renovate.json
├── .env.example  .dev.vars.example  .gitignore  .oxfmtrc.json  .oxlintrc.json
├── .github/workflows/{ci.yml,deploy-staging.yml,deploy-production.yml,backup-d1.yml,evals.yml}
├── actions/                      one framework action per file (thin)
├── agent/AGENTS.md               runtime agent instructions
├── app/                          React Router app (routes, components, i18n)
├── server/                       Nitro server: db client, plugins, middleware, routes
├── src/
│   ├── domain/                   pure business model
│   ├── application/              use cases, ports, authorization, errors, actor
│   ├── infrastructure/           D1/SQLite repositories, clock, ids, logging, container
│   └── interface/                action runner (glue between actions/ and application)
├── migrations/                   app-owned D1 SQL migrations
├── scripts/                      build, patch, migrate-local, seed, smoke, checks, backup
├── tests/{unit,integration,e2e,fixtures}
├── evals/
└── docs/                         user-facing docs + docs/plan
```

Removed from the scaffold: `app/routes/database.tsx`, `app/routes/extensions*.tsx`,
`app/routes/_index.tsx` marketing page (replaced by a redirect), `netlify.toml`,
`scripts/migrate-production.ts`, `changelog/`, `learnings*.md`, `DESIGN.md`, `CLAUDE.md`
symlink, and every `.agents/skills/*` except `actions`, `agent-native-docs`, `security`,
`storing-data` (keep those four; they are framework-provided lookup skills).

## B2. Layer rules (enforced by `scripts/check-boundaries.mjs`)

| Layer | Directory | May import from | Must never import |
| --- | --- | --- | --- |
| domain | `src/domain` | `src/domain` only | anything else, including `zod`, `node:*`, `@agent-native/*`, `react` |
| application | `src/application` | `src/domain`, `src/application` | `@agent-native/*`, `react`, `node:*`, `drizzle-orm`, `server/*`, `app/*` |
| infrastructure | `src/infrastructure` | `src/domain`, `src/application`, `@agent-native/core/db`, `@agent-native/core/org`, `@agent-native/core/server`, `node:crypto` | `react`, `app/*` |
| interface | `src/interface` | `src/application`, `src/infrastructure`, `@agent-native/core/action` | `react`, `app/*` |
| actions | `actions/` | `src/interface`, `src/application` (types only), `@agent-native/core/action`, `zod` | `src/infrastructure` directly, `server/db` |
| ui | `app/` | `@agent-native/core/client/*`, `react*`, `src/domain` (types and pure helpers only) | `src/application`, `src/infrastructure`, `server/*` |

The checker parses import specifiers with a regex over `import ... from "<spec>"` and
`import("<spec>")` and fails with file, line and the offending specifier.

## B3. Naming

- Action files and names: kebab-case verbs: `list-customers`, `get-customer`, `list-jobs`,
  `get-job`, `list-recent-activity`, `create-customer`, `archive-customer`, `create-job`,
  `reschedule-job`, `start-job`, `complete-job`, `archive-job`, `undo-operation`,
  `redo-operation`.
- Use case functions: camelCase, same words: `listCustomers`, `completeJob`, `undoOperation`.
- SQL: snake_case tables and columns. TypeScript: camelCase properties.
- Identifiers: `crypto.randomUUID()` strings. Seed identifiers are fixed strings (B12).
- Timestamps: ISO 8601 UTC with milliseconds, produced by `new Date().toISOString()`, stored
  as TEXT. Compare lexicographically.

## B4. Domain model (`src/domain`)

Files: `customer.ts`, `job.ts`, `operation.ts`, `errors.ts`, `index.ts`.

```ts
// src/domain/errors.ts
export type DomainErrorCode = "INVARIANT" | "VALIDATION";
export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string, public readonly details?: Record<string, unknown>) { super(message); }
}
```

```ts
// src/domain/customer.ts
export type CustomerStatus = "active" | "archived";
export interface Customer {
  id: string; orgId: string; name: string; email: string | null; phone: string | null;
  notes: string | null; status: CustomerStatus; version: number; createdBy: string;
  createdAt: string; updatedAt: string;
}
export interface NewCustomerInput { id: string; orgId: string; name: string; email?: string | null; phone?: string | null; notes?: string | null; createdBy: string; now: string; }
export function createCustomer(input: NewCustomerInput): Customer;      // validates name 1..200 (trimmed), email format if present, phone <= 40, notes <= 5000; version 1; status active
export function archiveCustomer(c: Customer, now: string): Customer;    // INVARIANT if already archived; version + 1
export function restoreCustomer(c: Customer, now: string): Customer;    // INVARIANT if active; version + 1
```

```ts
// src/domain/job.ts
export type JobStatus = "scheduled" | "in_progress" | "completed" | "archived";
export interface Job {
  id: string; orgId: string; customerId: string; title: string; description: string;
  status: JobStatus; scheduledAt: string; assignedTo: string | null; completedAt: string | null;
  archivedAt: string | null; accountingReference: string | null; accountingSentAt: string | null;
  version: number; createdBy: string; createdAt: string; updatedAt: string;
}
export interface NewJobInput { id: string; orgId: string; customerId: string; title: string; description?: string; scheduledAt: string; assignedTo?: string | null; createdBy: string; now: string; }
export function createJob(input: NewJobInput): Job;            // title 1..200, description <= 5000, scheduledAt valid ISO; status scheduled
export function startJob(job: Job, now: string): Job;          // allowed from scheduled only
export function completeJob(job: Job, now: string): Job;       // allowed from scheduled or in_progress; sets completedAt
export function rescheduleJob(job: Job, scheduledAt: string, now: string): Job; // allowed from scheduled or in_progress; INVARIANT if same instant
export function archiveJob(job: Job, now: string): Job;        // allowed from any status except archived; sets archivedAt
export function restoreJobStatus(job: Job, previous: { status: JobStatus; completedAt: string | null; archivedAt: string | null }, now: string): Job; // used by undo; no transition rule check, but version + 1
export function markSentToAccounting(job: Job, reference: string, now: string): Job; // INVARIANT unless status === "completed" and accountingReference === null; sets accountingReference/accountingSentAt; version + 1
export const JOB_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  scheduled: ["in_progress", "completed", "archived"],
  in_progress: ["completed", "archived"],
  completed: ["archived"],
  archived: [],
};
```

Every mutation returns a new object with `version: previous.version + 1` and
`updatedAt: now`. Every rule violation throws `DomainError("INVARIANT", ...)`; every input
problem throws `DomainError("VALIDATION", ...)`. No I/O, no Date.now() (time is an argument).

```ts
// src/domain/operation.ts
export type OperationKind = "forward" | "undo" | "redo";
export type OperationClassification = "reversible" | "compensatable" | "irreversible";
export type ResourceType = "customer" | "job";
export interface Operation {
  id: string; orgId: string; kind: OperationKind; action: string;           // action name, e.g. "complete-job"
  resourceType: ResourceType; resourceId: string;
  classification: OperationClassification;
  versionBefore: number; versionAfter: number;
  inverse: InverseCommand | null;          // how to undo this operation
  relatedOperationId: string | null;       // undo → the forward op it undoes; redo → the undo op it reverts
  undoneByOperationId: string | null;
  performedBy: string; performedVia: string; performedAt: string;
}
export type InverseCommand =
  | { type: "restore-job-status"; previous: { status: JobStatus; completedAt: string | null; archivedAt: string | null } }
  | { type: "restore-job-schedule"; previousScheduledAt: string }
  | { type: "archive-job" }              // compensation for create-job
  | { type: "restore-customer" }
  | { type: "archive-customer" };        // compensation for create-customer
export const OPERATION_CLASSIFICATION: Readonly<Record<string, OperationClassification>> = {
  "create-customer": "compensatable", "archive-customer": "reversible",
  "create-job": "compensatable", "reschedule-job": "reversible", "start-job": "reversible",
  "complete-job": "reversible", "archive-job": "reversible",
  "send-job-to-accounting": "irreversible",
  "undo-operation": "reversible", "redo-operation": "reversible",
};
export function canUndo(op: Operation, currentVersion: number): { ok: true } | { ok: false; reason: "already-undone" | "irreversible" | "conflict" | "not-forward" };
// ok only when kind === "forward" (or "redo"), classification !== "irreversible",
// undoneByOperationId === null, and currentVersion === versionAfter
```

## B5. Application errors (`src/application/errors.ts`)

```ts
export type AppErrorCode = "VALIDATION" | "AUTHENTICATION" | "AUTHORIZATION" | "NOT_FOUND" | "CONFLICT" | "INVARIANT" | "EXTERNAL" | "INTERNAL";
export const HTTP_STATUS_FOR: Record<AppErrorCode, number> = { VALIDATION: 400, AUTHENTICATION: 401, AUTHORIZATION: 403, NOT_FOUND: 404, CONFLICT: 409, INVARIANT: 422, EXTERNAL: 502, INTERNAL: 500 };
export class AppError extends Error { constructor(public readonly code: AppErrorCode, message: string, public readonly details?: Record<string, unknown>) { super(message); } }
export function fromDomainError(e: DomainError): AppError; // VALIDATION→VALIDATION, INVARIANT→INVARIANT
```

Messages are safe for end users and agents: no SQL, no stack, no internal ids beyond the
resource id. `INTERNAL` messages are the constant `"Unexpected error"`.

## B6. Authorization (`src/application/authorization.ts`)

```ts
export type Role = "owner" | "admin" | "member";
export type Capability =
  | "customers:read" | "customers:create" | "customers:archive"
  | "jobs:read" | "jobs:create" | "jobs:transition" | "jobs:reschedule" | "jobs:export"
  | "history:read" | "history:undo";
export const ROLE_CAPABILITIES: Readonly<Record<Role, readonly Capability[]>> = {
  member: ["customers:read", "customers:create", "jobs:read", "jobs:create", "jobs:transition", "jobs:reschedule", "history:read", "history:undo"],
  admin:  [...member, "customers:archive", "jobs:export"],
  owner:  [...admin],
};
export function hasCapability(role: Role, cap: Capability): boolean;
export function requireCapability(actor: Actor, cap: Capability): void; // throws AppError("AUTHORIZATION", `Role ${role} may not ${cap}`)
```

`archive-customer` and `send-job-to-accounting` are the admin-only demonstrations; `member
cannot perform an owner-only operation` tests use `archive-customer`. Organization administration (invites, roles) is framework-owned and
already restricted to owner/admin.

## B7. Actor and ports (`src/application/actor.ts`, `src/application/ports.ts`)

```ts
export interface Actor { userEmail: string; orgId: string; role: Role; caller: string; }
export interface RawContext { userEmail?: string; orgId?: string | null; caller?: string; }
export async function resolveActor(raw: RawContext, membership: MembershipReader): Promise<Actor>;
// no userEmail → AppError AUTHENTICATION "Sign in required"
// no orgId → AppError AUTHORIZATION "No active organization"
// membership.getRole(orgId, userEmail) === null → AppError AUTHORIZATION "Not a member of the active organization"
```

```ts
export interface Clock { now(): string }
export interface IdGenerator { next(): string }
export interface MembershipReader { getRole(orgId: string, userEmail: string): Promise<Role | null>; isMember(orgId: string, userEmail: string): Promise<boolean> }
export interface CustomerRepository {
  getById(orgId: string, id: string): Promise<Customer | null>;
  list(orgId: string, filter: { status?: CustomerStatus; search?: string }): Promise<Customer[]>;
  create(input: { customer: Customer; operation: Operation; idempotency?: { action: string; key: string } }): Promise<void>;
  commit(input: { customer: Customer; expectedVersion: number; operation: Operation; markUndone?: string }): Promise<void>; // ConflictError when 0 rows
}
export interface JobRepository {
  getById(orgId: string, id: string): Promise<Job | null>;
  list(orgId: string, filter: { status?: JobStatus; customerId?: string; from?: string; to?: string }): Promise<Job[]>;
  create(input: { job: Job; operation: Operation; idempotency?: { action: string; key: string } }): Promise<void>; // requires active customer in same org → NOT_FOUND otherwise
  commit(input: { job: Job; expectedVersion: number; operation: Operation; markUndone?: string }): Promise<void>;
}
export interface OperationRepository {
  getById(orgId: string, id: string): Promise<Operation | null>;
  listRecent(orgId: string, limit: number): Promise<Operation[]>;
  listForResource(orgId: string, type: ResourceType, id: string, limit: number): Promise<Operation[]>;
}
export interface IdempotencyStore { find(orgId: string, action: string, key: string): Promise<string | null>; } // returns resourceId
export interface ExternalAccountingSystem {          // src/application/ports/external-accounting.ts
  createInvoiceDraft(input: { idempotencyKey: string; orgId: string; customer: { id: string; name: string }; job: { id: string; title: string; completedAt: string } }): Promise<{ externalReference: string; alreadyExisted: boolean }>;
  // throws ExternalSystemError (src/application/ports/external-accounting.ts) with a safe message; the use case maps it to AppError EXTERNAL
}
export interface Dependencies { clock: Clock; ids: IdGenerator; membership: MembershipReader; customers: CustomerRepository; jobs: JobRepository; operations: OperationRepository; idempotency: IdempotencyStore; accounting: ExternalAccountingSystem; }
```

`commit` semantics: one atomic unit containing (1) the resource UPDATE guarded by
`version = expectedVersion`, (2) the operation INSERT guarded by the resource now being at
`version = expectedVersion + 1`, (3) when `markUndone` is given, the UPDATE of that operation's
`undone_by_operation_id`. If step 1 affected zero rows the adapter throws
`AppError("CONFLICT", "The record was changed by someone else")`.

## B8. Use cases (`src/application/use-cases/*.ts`)

One file per action name. Signature pattern:

```ts
export interface CompleteJobInput { jobId: string; expectedVersion?: number }
export interface CommandResult<T> { resource: T; operationId: string }
export async function completeJob(deps: Dependencies, actor: Actor, input: CompleteJobInput): Promise<CommandResult<Job>> {
  requireCapability(actor, "jobs:transition");
  const job = await deps.jobs.getById(actor.orgId, input.jobId);
  if (!job) throw new AppError("NOT_FOUND", "Job not found");
  if (input.expectedVersion !== undefined && input.expectedVersion !== job.version) throw new AppError("CONFLICT", "The job was changed by someone else");
  const now = deps.clock.now();
  const next = completeJobDomain(job, now);                      // may throw DomainError → fromDomainError
  const operation: Operation = { id: deps.ids.next(), orgId: actor.orgId, kind: "forward", action: "complete-job", resourceType: "job", resourceId: job.id, classification: "reversible", versionBefore: job.version, versionAfter: next.version, inverse: { type: "restore-job-status", previous: { status: job.status, completedAt: job.completedAt, archivedAt: job.archivedAt } }, relatedOperationId: null, undoneByOperationId: null, performedBy: actor.userEmail, performedVia: actor.caller, performedAt: now };
  await deps.jobs.commit({ job: next, expectedVersion: job.version, operation });
  return { resource: next, operationId: operation.id };
}
```

Per use case:

| Use case | Capability | Domain call | Inverse recorded | Notes |
| --- | --- | --- | --- | --- |
| `listCustomers` | customers:read | — | — | filter status default `active`; `includeArchived: true` lists all |
| `getCustomer` | customers:read | — | — | NOT_FOUND when missing or other org |
| `listJobs` | jobs:read | — | — | filters status, customerId, from/to on scheduledAt; default excludes archived |
| `getJob` | jobs:read | — | — | also returns the customer name |
| `listRecentActivity` | history:read | — | — | last N operations with `undoable` computed via `canUndo` against current versions |
| `createCustomer` | customers:create | createCustomer | archive-customer (compensation) | idempotencyKey optional |
| `archiveCustomer` | customers:archive | archiveCustomer | restore-customer | admin/owner only |
| `createJob` | jobs:create | createJob | archive-job (compensation) | customer must be active in org; assignedTo must be a member (MembershipReader.isMember) |
| `rescheduleJob` | jobs:reschedule | rescheduleJob | restore-job-schedule | |
| `startJob` | jobs:transition | startJob | restore-job-status | |
| `completeJob` | jobs:transition | completeJob | restore-job-status | |
| `archiveJob` | jobs:transition | archiveJob | restore-job-status | |
| `sendJobToAccounting` | jobs:export | markSentToAccounting | none (`irreversible`) | B22: vendor call with idempotency key `job:<jobId>`, then version-guarded local commit; admin/owner only; action has `needsApproval: true` |
| `undoOperation` | history:undo | per inverse | forward re-application | B9 |
| `redoOperation` | history:undo | per original action | inverse again | B9 |

Idempotent creates: before building the resource, `deps.idempotency.find(orgId, action, key)`;
when it returns an id, load and return that resource with `operationId` of its creating
operation (query `listForResource` and take the `forward` create op). When the create's atomic
write fails with a primary-key violation on `idempotency_keys`, retry the lookup once and return
the existing resource.

## B9. Undo and redo algorithm

`undoOperation(deps, actor, { operationId })`:
1. `op = operations.getById(orgId, operationId)`; NOT_FOUND if null.
2. Load the resource by `op.resourceType`/`op.resourceId`; NOT_FOUND if null.
3. `canUndo(op, resource.version)`: `already-undone` → CONFLICT "Already undone";
   `irreversible` → INVARIANT "This operation cannot be undone"; `conflict` → CONFLICT
   "Newer changes exist; undo refused"; `not-forward` → INVARIANT "Use redo for an undo
   operation".
4. Apply `op.inverse` through the domain: `restore-job-status` → `restoreJobStatus`;
   `restore-job-schedule` → `rescheduleJob` to the previous instant (bypass the "same instant"
   rule by calling `restoreJobSchedule`, a domain function that only checks status is not
   archived); `archive-job` → `archiveJob`; `restore-customer` → `restoreCustomer`;
   `archive-customer` → `archiveCustomer`.
5. Build `undoOp`: kind `undo`, action `undo-operation`, classification `reversible`,
   `relatedOperationId: op.id`, `inverse` = the forward command description needed for redo:
   `{ type: "redo", action: op.action, args: <original semantic args> }` — store the original
   args on the forward operation as `payload` (add `payload: Record<string, unknown> | null`
   to `Operation`; creates store the create input; transitions store `{}`; reschedule stores
   `{ scheduledAt }`).
6. `repo.commit({ resource: restored, expectedVersion: resource.version, operation: undoOp, markUndone: op.id })`.
7. Return `{ resource, operationId: undoOp.id }`.

`redoOperation(deps, actor, { operationId })` where `operationId` is an **undo** operation:
1. Load `undoOp`; INVARIANT unless `kind === "undo"` and `undoneByOperationId === null`.
2. Load the resource; CONFLICT unless `resource.version === undoOp.versionAfter`.
3. Load the forward op `undoOp.relatedOperationId`; re-run its domain transition with the
   stored `payload` (e.g. `completeJob(resource, now)`, `rescheduleJob(resource, payload.scheduledAt, now)`).
   Creates are never redone (their undo is a compensation): INVARIANT.
4. Record `redoOp`: kind `redo`, action `redo-operation`, `relatedOperationId: undoOp.id`,
   `inverse` = same inverse as the original forward op, and mark `undoOp.undoneByOperationId = redoOp.id`.

Concurrency example that must hold (unit test `tests/unit/application/undo.test.ts`):
user A completes job v12→v13 (op1); user B reschedules v13→v14 (op2); A calls undo(op1) →
CONFLICT; B calls undo(op2) → ok, v15; A calls undo(op1) → still CONFLICT (version 15 ≠ 13).

## B10. SQL schema (`migrations/0001_init.sql`) — normative

```sql
CREATE TABLE customers (
  id TEXT NOT NULL PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  email TEXT,
  phone TEXT CHECK (phone IS NULL OR length(phone) <= 40),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 5000),
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  version INTEGER NOT NULL CHECK (version >= 1),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, id)
);
CREATE INDEX customers_org_status_name_idx ON customers (org_id, status, name);

CREATE TABLE jobs (
  id TEXT NOT NULL PRIMARY KEY,
  org_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'archived')),
  scheduled_at TEXT NOT NULL,
  assigned_to TEXT,
  completed_at TEXT,
  archived_at TEXT,
  version INTEGER NOT NULL CHECK (version >= 1),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, customer_id) REFERENCES customers (org_id, id)
);
CREATE INDEX jobs_org_status_scheduled_idx ON jobs (org_id, status, scheduled_at);
CREATE INDEX jobs_org_customer_idx ON jobs (org_id, customer_id);

CREATE TABLE operations (
  id TEXT NOT NULL PRIMARY KEY,
  org_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('forward', 'undo', 'redo')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('customer', 'job')),
  resource_id TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('reversible', 'compensatable', 'irreversible')),
  version_before INTEGER NOT NULL,
  version_after INTEGER NOT NULL,
  payload TEXT,
  inverse TEXT,
  related_operation_id TEXT,
  undone_by_operation_id TEXT,
  performed_by TEXT NOT NULL,
  performed_via TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  UNIQUE (org_id, id)
);
CREATE INDEX operations_org_resource_idx ON operations (org_id, resource_type, resource_id, performed_at);
CREATE INDEX operations_org_performed_idx ON operations (org_id, performed_at);

CREATE TABLE idempotency_keys (
  org_id TEXT NOT NULL,
  action TEXT NOT NULL,
  key TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (org_id, action, key)
);
```

`migrations/0002_job_accounting.sql` (added by T27, an example of an additive "expand" migration):

```sql
ALTER TABLE jobs ADD COLUMN accounting_reference TEXT;
ALTER TABLE jobs ADD COLUMN accounting_sent_at TEXT;
```

`payload` and `inverse` hold JSON text. No foreign keys to framework tables (they are created
by the framework at runtime, possibly after this migration). `server/db/schema.ts` mirrors
these four tables with the framework helpers so `agent-native doctor` sees `org_id` on every
table.

## B11. Repository SQL and atomic writes (`src/infrastructure/d1`)

- `sql.ts` exports every statement as a named constant. Every constant that reads or writes
  `customers`, `jobs`, `operations` or `idempotency_keys` contains the literal `org_id = ?`.
  `tests/unit/infrastructure/sql-scoping.test.ts` imports the module and asserts this for every
  exported string.
- `atomic.ts`:

```ts
export interface Statement { sql: string; args: unknown[] }
export async function runAtomic(exec: DbExecLike, statements: Statement[]): Promise<number[]> // returns rowsAffected per statement
// if exec.atomicBatch: use it; else if exec.transaction: run sequentially inside it; else throw AppError INTERNAL "No atomic write support"
```

- `commit` implementation for jobs (customers analogous):

```sql
-- 1
UPDATE jobs SET status = ?, scheduled_at = ?, assigned_to = ?, completed_at = ?, archived_at = ?, accounting_reference = ?, accounting_sent_at = ?, version = ?, updated_at = ?
WHERE org_id = ? AND id = ? AND version = ?;   -- accounting columns exist from migration 0002 (T27); until then omit them
-- 2
INSERT INTO operations (id, org_id, kind, action, resource_type, resource_id, classification, version_before, version_after, payload, inverse, related_operation_id, undone_by_operation_id, performed_by, performed_via, performed_at)
SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?
WHERE EXISTS (SELECT 1 FROM jobs WHERE org_id = ? AND id = ? AND version = ?);   -- new version
-- 3 (only when markUndone)
UPDATE operations SET undone_by_operation_id = ? WHERE org_id = ? AND id = ? AND undone_by_operation_id IS NULL;
```

  After `runAtomic`, if `rowsAffected[0] !== 1` throw CONFLICT. Statement 2's guard makes the
  batch a no-op when statement 1 did not apply.
- `create` for jobs: `INSERT INTO jobs (...) SELECT ?, ?, ... WHERE EXISTS (SELECT 1 FROM
  customers WHERE org_id = ? AND id = ? AND status = 'active')`, then the operation insert
  guarded by `EXISTS (SELECT 1 FROM jobs WHERE org_id = ? AND id = ?)`, then optional
  `INSERT INTO idempotency_keys ...`. If `rowsAffected[0] !== 1` throw NOT_FOUND "Customer not
  found or archived".
- Row mappers convert `snake_case` rows to domain objects; JSON columns parsed with a guard.
- `MembershipReader` implementation: `SELECT role FROM org_members WHERE org_id = ? AND LOWER(email) = LOWER(?) LIMIT 1`.

## B12. Deterministic seed scenario (`tests/fixtures/scenario.ts`)

Constants (exact strings):

| Kind | Id / value |
| --- | --- |
| Organizations | `org_acme` "Acme Services"; `org_other` "Other Company" |
| Users (password: `SEED_PASSWORD`, default `Example-Seed-Password-2026`) | `owner@example.invalid` (owner, org_acme); `admin@example.invalid` (admin, org_acme); `member1@example.invalid` (member, org_acme); `member2@example.invalid` (member, org_acme); `outsider@example.invalid` (owner, org_other) |
| Customers (org_acme) | `cus_a` "Example Customer A" active; `cus_b` "Example Customer B" active; `cus_archived` "Archived Customer" archived |
| Customer (org_other) | `cus_other` "Other Company Customer" active |
| Jobs (org_acme, customer cus_a unless noted) | `job_scheduled` "Scheduled job" scheduled 2026-10-01T08:00:00.000Z assigned member1; `job_in_progress` "In-progress job" in_progress; `job_completed` "Completed job" completed (cus_b); `job_archived` "Archived job" archived (cus_b) |
| Job (org_other) | `job_other` "Other Company job" scheduled, customer cus_other |
| Operations | one `forward` create op per customer/job with version_before 0, version_after 1, performed_by owner@example.invalid, performed_via `seed`, performed_at 2026-09-01T09:00:00.000Z; plus for `job_in_progress` a `start-job` op (1→2) and for `job_completed` a `complete-job` op (1→2) |
| Versions | customers 1; job_scheduled 1; job_in_progress 2; job_completed 2; job_archived 2 (create + archive op) |

`buildScenarioSql(): string[]` returns INSERT statements (no DELETE) for organizations,
org_members, customers, jobs, operations. `buildScenarioResetSql(): string[]` returns DELETE
statements for those tables filtered by the two org ids, plus `DELETE FROM org_members WHERE
org_id IN (...)` and `DELETE FROM organizations WHERE id IN (...)`. Users are created over HTTP by
`scripts/seed.mjs`, never by SQL. Scenario builders `createCompanyWithMembers()`,
`createScheduledJob()`, `createCompletedJob()`, `createForeignOrganizationJob()` are the
named pieces that compose into the full scenario and are also used directly by unit tests with
in-memory repositories.

## B13. Environment matrix

| Variable | local (`pnpm dev`) | local worker / CI | staging | production |
| --- | --- | --- | --- | --- |
| `APP_ENV` | `local` | `ci` (or `local`) | `staging` | `production` |
| `NODE_ENV` | (unset) | `production` (Worker var) | `production` | `production` |
| `DATABASE_URL` | `file:./data/app.db` | unset (D1) | unset | unset |
| `APP_URL` | `http://localhost:8080` | `http://127.0.0.1:8787` | `https://<staging host>` | `https://<prod host>` |
| `BETTER_AUTH_SECRET` | any 32+ chars | generated | secret | secret |
| `OAUTH_STATE_SECRET` | – | – | secret | secret |
| `AUTO_CREATE_DEFAULT_ORG` | `0` | `0` | `0` | `0` |
| `AGENT_NATIVE_DISABLE_AUTO_DEV_ACCOUNT` | `1` | `1` | – | – |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `0` | `0` | `0` | `1` (Worker var; declares the policy) |
| `GOOGLE_SIGN_IN_CLIENT_ID/SECRET` | – | – | secrets | secrets |
| `ANTHROPIC_API_KEY` | optional | – | secret | secret |
| `SEED_ENABLED` | `1` | `1` | `1` (QA org only) | forbidden |
| `SEED_PASSWORD` | default | default | secret | forbidden |
| `AGENT_NATIVE_AUDIT_RETENTION_DAYS` | – | – | `365` | `0` |

Files: `.env` (Node dev server, git-ignored), `.dev.vars` (Wrangler local, git-ignored),
`.env.example` and `.dev.vars.example` (committed, names only). Worker `vars` in
`wrangler.jsonc` hold non-secret values per environment; secrets via `wrangler secret put`.

Startup check (`server/plugins/00-env-check.ts`), fails the process with a single clear
message: production requires `BETTER_AUTH_SECRET` (≥32), `OAUTH_STATE_SECRET`, `APP_URL`
(https), `GOOGLE_SIGN_IN_CLIENT_ID`, `GOOGLE_SIGN_IN_CLIENT_SECRET`, `ANTHROPIC_API_KEY`; forbids
`AUTH_DISABLED`, `SEED_ENABLED`, `ACCESS_TOKEN(S)`, `AGENT_PROD_CODE_EXECUTION`,
`DATABASE_URL`. `local` forbids `APP_ENV=production` and any `DATABASE_URL` not starting with
`file:`. `APP_ENV` missing → treated as `local` (there is no reliable way to tell a Worker from the
dev server inside the pure validator); an unknown value is a violation. Violation strings never
contain values. Production forbids `DATABASE_URL`, `ACCESS_TOKEN`, `ACCESS_TOKENS` when present at
all, and treats `AUTH_DISABLED`, `SEED_ENABLED`, `AGENT_PROD_CODE_EXECUTION` as violations only
when enabled (`""`, `0`, `false`, `off`, `no` pass), so `SEED_ENABLED=0` may be stated explicitly.

## B14. Worker build pipeline

`pnpm build:worker` runs, in order:
1. `NITRO_PRESET=cloudflare_pages NODE_ENV=production agent-native build` → `dist/`.
2. `node scripts/patch-worker-bundle.mjs` — applies the two regex replacements from F9 to
   `dist/_worker.js/index.js`; each must match exactly once; writes
   `dist/_worker.js/PATCHED.json` `{ "patches": ["fs-default-proxy","os-default-proxy"], "coreVersion": "0.176.5" }`;
   exits 1 with a message naming the failing pattern otherwise; idempotent (second run finds the
   marker and exits 0).
3. `node scripts/check-bundle-size.mjs` — gzips every file under `dist/_worker.js/**/*.js`,
   sums, fails above 8 MiB, prints the total.
4. Writes `dist/BUILD_INFO.json` `{ "sha": <git sha>, "builtAt": <iso>, "coreVersion": "0.176.5" }`.

`wrangler.jsonc` (normative skeleton):

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "example-jobs",
  "main": "dist/_worker.js/index.js",
  "compatibility_date": "2026-09-05",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": "dist", "binding": "ASSETS" },
  "observability": { "enabled": true, "head_sampling_rate": 1 },
  "vars": { "APP_ENV": "local", "NODE_ENV": "production", "APP_URL": "http://127.0.0.1:8787", "AUTO_CREATE_DEFAULT_ORG": "0", "AGENT_NATIVE_DISABLE_AUTO_DEV_ACCOUNT": "1", "AUTH_REQUIRE_EMAIL_VERIFICATION": "0", "SEED_ENABLED": "1" },
  "d1_databases": [{ "binding": "DB", "database_name": "example-jobs-local", "database_id": "00000000-0000-0000-0000-000000000000", "migrations_dir": "migrations" }],
  "env": {
    "staging": {
      "name": "example-jobs-staging",
      "vars": { "APP_ENV": "staging", "NODE_ENV": "production", "APP_URL": "https://REPLACE_ME_STAGING_HOST", "AUTO_CREATE_DEFAULT_ORG": "0", "AUTH_REQUIRE_EMAIL_VERIFICATION": "0", "SEED_ENABLED": "1", "AGENT_NATIVE_AUDIT_RETENTION_DAYS": "365" },
      "d1_databases": [{ "binding": "DB", "database_name": "example-jobs-staging", "database_id": "REPLACE_ME", "migrations_dir": "migrations" }]
    },
    "production": {
      "name": "example-jobs-production",
      "vars": { "APP_ENV": "production", "NODE_ENV": "production", "APP_URL": "https://REPLACE_ME_PRODUCTION_HOST", "AUTO_CREATE_DEFAULT_ORG": "0", "AUTH_REQUIRE_EMAIL_VERIFICATION": "1", "AGENT_NATIVE_AUDIT_RETENTION_DAYS": "0" },
      "d1_databases": [{ "binding": "DB", "database_name": "example-jobs-production", "database_id": "REPLACE_ME", "migrations_dir": "migrations" }]
    }
  }
}
```

Secrets (never in this file): `BETTER_AUTH_SECRET`, `OAUTH_STATE_SECRET`,
`GOOGLE_SIGN_IN_CLIENT_ID`, `GOOGLE_SIGN_IN_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `SEED_PASSWORD`.
Locally they come from `.dev.vars`.

## B15. Scripts (`package.json`)

| Script | Command |
| --- | --- |
| `dev` | `agent-native dev` (Node, `.env`, local SQLite) |
| `dev:worker` | `pnpm build:worker && pnpm dev:worker:serve` |
| `dev:worker:serve` | `wrangler dev --port 8787 --ip 127.0.0.1 --local` |
| `build:worker` | `node scripts/build-worker.mjs` (B14 steps 1–4) |
| `db:migrate` | `node scripts/migrate-local.mjs` (Node SQLite file) |
| `db:migrate:worker` | `wrangler d1 migrations apply example-jobs-local --local` |
| `db:reset` | `node scripts/reset-local.mjs` (deletes `data/app.db*` and `.wrangler/state`, then migrates both) |
| `db:seed` | `node scripts/seed.mjs --target node` |
| `db:seed:worker` | `node scripts/seed.mjs --target d1-local` |
| `db:migrate:staging` | `wrangler d1 migrations apply example-jobs-staging --remote --env staging` |
| `db:migrate:production` | `wrangler d1 migrations apply example-jobs-production --remote --env production` |
| `lint` | `oxlint . && oxfmt --check .` |
| `typecheck` | `agent-native typecheck` |
| `agent-native:doctor` | `agent-native doctor` (never name a script `doctor`: pnpm 11 has a built-in `doctor` subcommand that shadows it) |
| `check:boundaries` | `node scripts/check-boundaries.mjs` |
| `check:config` | `node scripts/check-config-hygiene.mjs` (D17 forbidden keys; no `REPLACE_ME` outside env blocks; secrets not in vars) |
| `check` | `pnpm lint && pnpm typecheck && pnpm agent-native:doctor && pnpm check:boundaries && pnpm check:config && pnpm test:unit` |
| `test:unit` | `vitest --run` |
| `test:integration` | `node scripts/test-integration.mjs` (CLI surface tests against a fresh Node SQLite DB) |
| `test:e2e` | `playwright test` (expects `dist/` built; CI builds first) |
| `test:e2e:full` | `pnpm build:worker && playwright test` |
| `smoke` | `node scripts/worker-smoke.mjs --base-url http://127.0.0.1:8787 --mode local` |
| `deploy:staging` | `wrangler deploy --env staging` |
| `deploy:production` | `wrangler deploy --env production` |
| `backup:d1` | `bash scripts/backup-d1.sh` |
| `eval` | `agent-native eval` |
| `action` | `agent-native action` |

## B16. Actions and the runner (`src/interface/run-app-action.ts`)

```ts
import { fail } from "@agent-native/core/action";
export async function runAppAction<T>(ctx: ActionRunContext | undefined, actionName: string, fn: (actor: Actor, deps: Dependencies) => Promise<T>): Promise<T> {
  const deps = getDependencies();            // src/infrastructure/container.ts singleton
  const started = Date.now();
  try {
    const actor = await resolveActor({ userEmail: ctx?.userEmail, orgId: ctx?.orgId, caller: ctx?.caller ?? "unknown" }, deps.membership);
    const result = await fn(actor, deps);
    logAction({ action: actionName, outcome: "success", caller: actor.caller, orgId: actor.orgId, durationMs: Date.now() - started });
    return result;
  } catch (err) {
    const appErr = toAppError(err);           // AppError passthrough; DomainError → fromDomainError; else INTERNAL (log the original with stack)
    logAction({ action: actionName, outcome: "error", errorCode: appErr.code, caller: ctx?.caller, orgId: ctx?.orgId ?? null, durationMs: Date.now() - started });
    return fail(appErr.message, { errorCode: appErr.code, statusCode: HTTP_STATUS_FOR[appErr.code], details: appErr.details });
  }
}
```

Action file template (normative):

```ts
// actions/complete-job.ts
import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { runAppAction } from "../src/interface/run-app-action";
import { completeJob } from "../src/application/use-cases/complete-job";

export default defineAction({
  description: "Mark a job as completed. Use when the work for a job is done. Reversible with undo-operation.",
  schema: z.object({
    jobId: z.string().min(1).describe("Id of the job to complete"),
    expectedVersion: z.number().int().positive().optional().describe("Version the caller last saw; the call fails with CONFLICT if it changed"),
  }),
  mcpTool: true,
  audit: {
    target: (args) => ({ type: "job", id: args.jobId, visibility: "org" }),
    summary: (args) => `Completed job ${args.jobId}`,
  },
  run: (args, ctx) => runAppAction(ctx, "complete-job", (actor, deps) => completeJob(deps, actor, args)),
});
```

Queries use `http: { method: "GET" }` and `readOnly: true`. Every description states when to
use the action and whether it is reversible. `view-screen` and `navigate` keep
`mcpTool: false`. `hello.ts` and `run.ts` are deleted.

Structured log line (`src/infrastructure/logging.ts`): one JSON object per action call:
`{ "level": "info"|"error", "event": "action", "action", "outcome", "errorCode"?, "caller",
"orgId", "durationMs", "requestId"? }`. Never includes emails, arguments or results.

## B17. UI (React Router under `app/`)

Routes: `/` → redirect `/jobs`; `/jobs` list with status filter and "New job" dialog; `/jobs/:id`
detail with actions Start, Complete, Reschedule (date-time input), Archive, and the operation
history for that job; `/customers` list with "New customer" dialog, archive button visible only
when `useOrgRole()` says admin/owner (server still enforces); `/customers/:id`; `/activity`
recent operations with undo/redo buttons; `/team` (framework `TeamPage`); `/settings`
(framework settings including `LanguagePicker`). The scaffold `Layout` with the agent sidebar
stays. After every successful mutation show a `sonner` toast with an "Undo" button that calls
`undo-operation` with the returned `operationId`; after undo show "Redo". All strings through
`useT()`; dates through `useFormatters()`. Data fetching: `useActionQuery`; mutations:
`useActionMutation`; invalidate queries on success (the framework's `useDbSync` also refreshes).
Error display: map `errorCode` to `errors.<CODE>` catalog keys, fall back to the server message.

## B18. Testing design

- Unit (`tests/unit`): domain transitions and invariants; authorization matrix; every use case
  (including `send-job-to-accounting` with the mock accounting adapter, B22) with in-memory repositories (`tests/fixtures/in-memory.ts`) including org isolation (actor in
  `org_other` cannot read/mutate `org_acme` data → NOT_FOUND, never leaks); undo/redo including
  the B9 conflict scenario; SQL scoping test; config hygiene test; runner error mapping.
- Integration (`tests/integration`): against a fresh Node SQLite DB (`DATABASE_URL=file:./data/test-integration.db`) migrated with `scripts/migrate-local.mjs` and seeded with SQL: real D1-shaped repositories through `getDbExec()`; CLI surface parity `AGENT_USER_EMAIL=member1@example.invalid AGENT_ORG_ID=org_acme pnpm action complete-job '{"jobId":"job_in_progress"}'` returns the job with status completed and a new `forward` operation exists; the same via `AGENT_ORG_ID=org_other` returns NOT_FOUND.
- End-to-end (`tests/e2e`, Playwright, one worker, chromium): server = built Worker under `wrangler dev` started by `scripts/e2e-server.mjs` (reset `.wrangler/state`, apply migrations, seed SQL, exec wrangler dev); `global-setup.ts` registers the five users over HTTP, logs each in, stores `tests/e2e/.auth/<name>.json` storage states; fixtures `ownerPage`, `adminPage`, `memberPage`, `outsiderPage`; every page fixture attaches a request listener that fails the test on any request whose URL origin differs from `baseURL`. Required specs: sign-in and dashboard (owner); member lists jobs; member completes `job_in_progress`; mutation appears in activity and in the framework audit trail (`list-audit-events` shows `complete-job` with `caller: "frontend"`); undo restores status and appears as its own operation; undo conflict (complete via UI, reschedule via HTTP as another user, then UI undo shows the conflict error); outsider navigating to `/jobs/job_scheduled` sees not-found, and `GET /_agent-native/actions/get-job?jobId=job_scheduled` as outsider returns 404; member calling `archive-customer` over HTTP gets 403; HTTP call to `complete-job` (caller `http`) and UI click hit the same action (audit rows differ only in `caller`).
- Smoke (`scripts/worker-smoke.mjs`): B19.
- Evals (`evals/*.eval.ts`): `complete-job` prompt → `usesTool("complete-job")`; "show today's jobs" → `usesTool("list-jobs")` and a custom scorer asserting no mutating tool in `toolCalls`; "undo that" → `usesTool("undo-operation")`; all with `skipReason` unless `RUN_MODEL_EVALS=1`.

## B19. Worker smoke contract (`scripts/worker-smoke.mjs`)

Arguments: `--base-url`, `--mode local|staging|production`, optional `--qa-email`,
`--qa-password`, `--expect-org-id`. Exit 0 only when every check passes; prints one line per
check `[ok]`/`[fail] <check>: <detail>`.

| Check | local | staging | production |
| --- | --- | --- | --- |
| `GET /_agent-native/ping` is 200 `{"message":"pong"}` | yes | yes | yes |
| `GET /_agent-native/health` 200, `db === true`, `database.dialect === "d1"` | yes | yes | yes |
| `GET /api/ready` 200 with `migrations.applied === migrations.expected` | yes | yes | yes |
| `GET /sign-in` 200 HTML | yes | yes | yes |
| `GET /` is 200 (the Worker serves the static shell `dist/index.html`; the redirect to `/jobs` is client-side, never expect a 302) | yes | yes | yes |
| `GET /_agent-native/actions/list-jobs` unauthenticated is 401 | yes | yes | yes |
| Login with QA user, `org/me.orgId === --expect-org-id` | yes | yes | no |
| `list-jobs` authenticated is 200 array | yes | yes | no |
| Reversible write: `create-job` with `idempotencyKey: smoke-<runId>` then `archive-job` it; both 200 | yes | yes | no |
| `POST /_agent-native/agent-chat` responds `text/event-stream`; local expects first event `missing_credentials`; staging expects a stream that does not start with an `error` event | yes | yes | no |
| `POST /mcp` unauthenticated is 401 with `WWW-Authenticate` | yes | yes | yes |

`/api/ready` is `server/routes/api/ready.get.ts`: counts rows in `d1_migrations` (D1) or the
local runner's table, compares with the number of files in `migrations/` embedded at build
time through a generated `src/infrastructure/migrations-manifest.ts` (T06), returns
`{ ready, migrations: { applied, expected } }`, HTTP 503 when not ready.

## B20. CI/CD design

`ci.yml` (pull_request, push to main): job `verify` — checkout, pnpm setup, `pnpm install
--frozen-lockfile`, `pnpm check`, `pnpm test:integration`; job `worker` (needs verify) —
`pnpm build:worker`, upload artifact `worker-bundle` (dist/), generate `.dev.vars` with a random
`BETTER_AUTH_SECRET`, `pnpm exec playwright install --with-deps chromium`, `pnpm test:e2e`
(its server script migrates and seeds), then `pnpm smoke` against the still-running server is
covered inside the e2e global setup (call the smoke script from `global-setup.ts` in local mode).
Concurrency group per ref. Timeouts 30 minutes.

`deploy-staging.yml` (push to main, after ci succeeds via `workflow_run` on ci.yml completed
+ success, or by `needs` if combined; choose `workflow_run`): environment `staging`; secrets
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SEED_PASSWORD`; steps: build worker, upload
artifact `worker-bundle-<sha>` (retention 90 days), `pnpm db:migrate:staging`,
`pnpm deploy:staging`, `node scripts/seed.mjs --target d1-remote --env staging --reset`
(QA org only), smoke in staging mode with the QA owner.

`deploy-production.yml` (workflow_dispatch with input `staging_run_id`): environment
`production` (required reviewers); download artifact `worker-bundle-<sha>` from that run with
`gh run download`, verify `dist/BUILD_INFO.json.sha` equals the run's head sha; record
`wrangler d1 time-travel info example-jobs-production --env production --json` into the job
summary; `pnpm db:migrate:production`; `pnpm deploy:production`; smoke in production mode; on
failure print rollback instructions (`wrangler rollback --env production`) into the summary.

`backup-d1.yml` (schedule daily 03:00 UTC + dispatch): environment `production`; `scripts/backup-d1.sh`
exports `example-jobs-production`, gzip, optional `age` encryption when `BACKUP_AGE_RECIPIENT`
is set, upload to S3-compatible storage when `BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`,
`BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` are set, else upload as artifact with
30-day retention; verifies the export by running `sqlite3`-free check: file size > 0 and
contains `CREATE TABLE customers`.

`evals.yml` (workflow_dispatch + weekly): Node runtime, `pnpm db:reset && pnpm db:seed`,
`RUN_MODEL_EVALS=1 ANTHROPIC_API_KEY=... pnpm eval --json`, upload the report.

## B21. Documentation set (T23)

`README.md`, `ARCHITECTURE.md` (Mermaid diagrams: runtime, request flow, action flow, parity,
auth vs authz, org scoping, layers, ports/adapters, audit/undo, CI/CD, environments, backup),
`AGENTS.md`, `agent/AGENTS.md`, `docs/adding-a-feature.md`, `docs/actions-and-use-cases.md`,
`docs/authentication-and-authorization.md`, `docs/database-and-migrations.md`,
`docs/testing.md`, `docs/undo-and-history.md`, `docs/integrations.md`, `docs/deployment.md`,
`docs/backups.md`, `docs/runbook.md`, `docs/observability.md`, `docs/internationalization.md`,
`docs/bootstrap.md` (post-template checklist), `docs/upgrade-playbook.md`,
`docs/template-workflow.md` (porting with format-patch, community template registration),
`docs/repository-settings.md` (branch protection, environments). Each has the sections listed
in T23.

## B22. External integration pattern (`send-job-to-accounting`)

Purpose: prove, with tests, how a command that writes to an external system fits the same
boundary. Files: `src/application/ports/external-accounting.ts` (port + `ExternalSystemError`),
`src/infrastructure/mock/mock-accounting.ts` (deterministic adapter: returns
`{ externalReference: "ACC-" + job.id, alreadyExisted: <key seen before> }`, keeps an in-memory
map of keys, can be told to fail with `failNextCall(message)` for tests),
`src/application/use-cases/send-job-to-accounting.ts`, `actions/send-job-to-accounting.ts`.

Use case `sendJobToAccounting(deps, actor, { jobId, expectedVersion? })`:
1. `requireCapability(actor, "jobs:export")`.
2. Load job (NOT_FOUND) and customer (NOT_FOUND); `expectedVersion` check (CONFLICT).
3. Domain precondition through `markSentToAccounting` (T04 messages, now normative): status must
   be `completed` (INVARIANT "Cannot send to accounting a job that is <status>") and
   `accountingReference` must be null (INVARIANT "Job was already sent to accounting"). Call the
   domain function once, after the vendor call, and use a pure precheck helper
   `assertCanSendToAccounting(job)` exported from `src/domain/job.ts` (add it in T27) before the
   vendor call so no external call happens for an ineligible job.
4. Call `deps.accounting.createInvoiceDraft({ idempotencyKey: "job:" + job.id, orgId, customer, job })`.
   `ExternalSystemError` → `AppError("EXTERNAL", "Accounting system unavailable: <safe message>")`;
   nothing is written locally.
5. `next = markSentToAccounting(job, result.externalReference, now)`; operation: kind `forward`,
   action `send-job-to-accounting`, classification `irreversible`, inverse `null`, payload
   `{ externalReference, alreadyExisted }`; `deps.jobs.commit({ job: next, expectedVersion: job.version, operation })`.
   A CONFLICT here means someone changed the job between steps 2 and 5; the vendor already holds
   the draft under the idempotency key, so the caller retries and step 4 returns
   `alreadyExisted: true` with the same reference. This is the documented two-step pattern.
6. Return `{ resource: next, operationId, externalReference }`.

Action: `needsApproval: true` (the agent must get a human approval for the exact call),
`mcpTool: true`, audit target job, summary `Sent job <id> to accounting (<reference>)`,
description states it is irreversible and requires the job to be completed.

Container: `accounting` is the mock adapter in every environment of the starter. A real
adapter is added by implementing the port in `src/infrastructure/<vendor>/` and selecting it in
the container from `APP_ENV`-independent configuration (documented in `docs/integrations.md`,
never in this sample).
