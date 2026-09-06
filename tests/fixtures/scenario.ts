/**
 * Deterministic seed scenario (blueprint B12).
 *
 * Every id, email, name and timestamp here is a fixed constant: AGENTS.md
 * forbids random test data, so a failing assertion always points at the same
 * fixture, run after run. `buildScenarioSql`/`buildScenarioResetSql` (T11)
 * will turn the same constants into D1 statements, and `scripts/seed.mjs`
 * creates the user accounts over HTTP (never SQL) — this file only builds
 * the domain objects and loads them into an in-memory `Dependencies`.
 *
 * The customer/job/operation objects are produced by calling the real
 * domain functions (`createCustomer`, `createJob`, `startJob`, …) with fixed
 * `now` values instead of being hand-typed, so a version, an `updatedAt`, or
 * an inverse command can never drift from what the domain layer would
 * actually produce for the same sequence of calls.
 *
 * `createCompanyWithMembers`, `createScheduledJob`, `createCompletedJob` and
 * `createForeignOrganizationJob` are the named scenario builders blueprint
 * B12 calls for; `createInProgressJob` and `createArchivedJob` are built the
 * same way for the same reason, to produce `job_in_progress` and
 * `job_archived`. `seedInMemory` composes all six into the full scenario.
 */

import type { Role } from "../../src/application/authorization";
import {
  archiveJob,
  completeJob,
  createCustomer,
  createJob,
  startJob,
  OPERATION_CLASSIFICATION,
  type Customer,
  type InverseCommand,
  type Job,
  type Operation,
  type OperationClassification,
  type ResourceType,
} from "../../src/domain";
import type { InMemoryDependencies } from "./in-memory";

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const ORG_ACME_ID = "org_acme";
export const ORG_ACME_NAME = "Acme Services";
export const ORG_OTHER_ID = "org_other";
export const ORG_OTHER_NAME = "Other Company";

// ---------------------------------------------------------------------------
// Users. Accounts are created over HTTP by `scripts/seed.mjs` (never SQL);
// this is only the membership/role wiring the in-memory `MembershipReader`
// needs.
// ---------------------------------------------------------------------------

export const OWNER_EMAIL = "owner@example.invalid";
export const ADMIN_EMAIL = "admin@example.invalid";
export const MEMBER1_EMAIL = "member1@example.invalid";
export const MEMBER2_EMAIL = "member2@example.invalid";
export const OUTSIDER_EMAIL = "outsider@example.invalid";

export const DEFAULT_SEED_PASSWORD = "Example-Seed-Password-2026";

export interface SeedMembership {
  orgId: string;
  email: string;
  role: Role;
}

export const SEED_MEMBERSHIPS: readonly SeedMembership[] = [
  { orgId: ORG_ACME_ID, email: OWNER_EMAIL, role: "owner" },
  { orgId: ORG_ACME_ID, email: ADMIN_EMAIL, role: "admin" },
  { orgId: ORG_ACME_ID, email: MEMBER1_EMAIL, role: "member" },
  { orgId: ORG_ACME_ID, email: MEMBER2_EMAIL, role: "member" },
  { orgId: ORG_OTHER_ID, email: OUTSIDER_EMAIL, role: "owner" },
];

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const CUSTOMER_A_ID = "cus_a";
export const CUSTOMER_A_NAME = "Example Customer A";
export const CUSTOMER_B_ID = "cus_b";
export const CUSTOMER_B_NAME = "Example Customer B";
export const CUSTOMER_ARCHIVED_ID = "cus_archived";
export const CUSTOMER_ARCHIVED_NAME = "Archived Customer";
export const CUSTOMER_OTHER_ID = "cus_other";
export const CUSTOMER_OTHER_NAME = "Other Company Customer";

// ---------------------------------------------------------------------------
// Jobs. Only `job_scheduled`'s instant is given by B12 directly; the other
// jobs' `scheduledAt` values are fixed, deterministic choices consistent
// with their status (a completed or archived job is scheduled in the past
// relative to the fixture clock, `2026-09-06T12:00:00.000Z`).
// ---------------------------------------------------------------------------

export const JOB_SCHEDULED_ID = "job_scheduled";
export const JOB_SCHEDULED_TITLE = "Scheduled job";
export const JOB_SCHEDULED_AT = "2026-10-01T08:00:00.000Z";

export const JOB_IN_PROGRESS_ID = "job_in_progress";
export const JOB_IN_PROGRESS_TITLE = "In-progress job";
export const JOB_IN_PROGRESS_SCHEDULED_AT = "2026-09-10T09:00:00.000Z";

export const JOB_COMPLETED_ID = "job_completed";
export const JOB_COMPLETED_TITLE = "Completed job";
export const JOB_COMPLETED_SCHEDULED_AT = "2026-09-05T09:00:00.000Z";

export const JOB_ARCHIVED_ID = "job_archived";
export const JOB_ARCHIVED_TITLE = "Archived job";
export const JOB_ARCHIVED_SCHEDULED_AT = "2026-09-08T09:00:00.000Z";

export const JOB_OTHER_ID = "job_other";
export const JOB_OTHER_TITLE = "Other Company job";
export const JOB_OTHER_SCHEDULED_AT = "2026-10-02T08:00:00.000Z";

// ---------------------------------------------------------------------------
// Timestamps. B12 fixes the create instant for every resource; the
// transition instants are fixed, strictly later values so `listRecent`
// ordering is unambiguous in tests.
// ---------------------------------------------------------------------------

const SEED_CREATED_AT = "2026-09-01T09:00:00.000Z";
const SEED_STARTED_AT = "2026-09-02T09:00:00.000Z";
const SEED_COMPLETED_AT = "2026-09-02T09:00:00.000Z";
const SEED_ARCHIVED_AT = "2026-09-03T09:00:00.000Z";

type SeedAction =
  | "create-customer"
  | "create-job"
  | "start-job"
  | "complete-job"
  | "archive-job";

function classificationFor(action: SeedAction): OperationClassification {
  const found = OPERATION_CLASSIFICATION[action];
  if (!found) {
    throw new Error(`No classification registered for action "${action}"`);
  }
  return found;
}

/** Every seed operation was, in this fiction, performed by the seed script
 * itself while signed in as `owner@example.invalid` (blueprint B12) — even
 * the `org_other` resources, which is why `performedBy` here is always the
 * same constant while each resource's own `createdBy` is its own org's
 * owner. */
function forwardOperation(input: {
  id: string;
  orgId: string;
  action: SeedAction;
  resourceType: ResourceType;
  resourceId: string;
  versionBefore: number;
  versionAfter: number;
  payload: Record<string, unknown>;
  inverse: InverseCommand;
  performedAt: string;
}): Operation {
  return {
    id: input.id,
    orgId: input.orgId,
    kind: "forward",
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    classification: classificationFor(input.action),
    versionBefore: input.versionBefore,
    versionAfter: input.versionAfter,
    payload: input.payload,
    inverse: input.inverse,
    relatedOperationId: null,
    undoneByOperationId: null,
    performedBy: OWNER_EMAIL,
    performedVia: "seed",
    performedAt: input.performedAt,
  };
}

function createJobPayload(job: Job): Record<string, unknown> {
  return {
    customerId: job.customerId,
    title: job.title,
    description: job.description,
    scheduledAt: job.scheduledAt,
    assignedTo: job.assignedTo,
  };
}

function createCustomerPayload(customer: Customer): Record<string, unknown> {
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    notes: customer.notes,
  };
}

/** A job's status/completedAt/archivedAt before a transition, the shape
 * `restore-job-status` needs to undo it (blueprint B9). */
function statusBefore(job: Job): InverseCommand {
  return {
    type: "restore-job-status",
    previous: {
      status: job.status,
      completedAt: job.completedAt,
      archivedAt: job.archivedAt,
    },
  };
}

export interface CompanyWithMembers {
  orgId: string;
  orgName: string;
  memberships: readonly SeedMembership[];
  customers: readonly Customer[];
  operations: readonly Operation[];
}

/** `org_acme`, its four members and its three customers — one of them,
 * `cus_archived`, inserted already archived (blueprint B12 fixes every
 * customer at version 1, so this is not `createCustomer` followed by
 * `archiveCustomer`, which would leave version 2). */
export function createCompanyWithMembers(): CompanyWithMembers {
  const customerA = createCustomer({
    id: CUSTOMER_A_ID,
    orgId: ORG_ACME_ID,
    name: CUSTOMER_A_NAME,
    createdBy: OWNER_EMAIL,
    now: SEED_CREATED_AT,
  });
  const customerB = createCustomer({
    id: CUSTOMER_B_ID,
    orgId: ORG_ACME_ID,
    name: CUSTOMER_B_NAME,
    createdBy: OWNER_EMAIL,
    now: SEED_CREATED_AT,
  });
  const customerArchived: Customer = {
    ...createCustomer({
      id: CUSTOMER_ARCHIVED_ID,
      orgId: ORG_ACME_ID,
      name: CUSTOMER_ARCHIVED_NAME,
      createdBy: OWNER_EMAIL,
      now: SEED_CREATED_AT,
    }),
    status: "archived",
  };

  const operations: Operation[] = [
    forwardOperation({
      id: "op_create_cus_a",
      orgId: ORG_ACME_ID,
      action: "create-customer",
      resourceType: "customer",
      resourceId: customerA.id,
      versionBefore: 0,
      versionAfter: 1,
      payload: createCustomerPayload(customerA),
      inverse: { type: "archive-customer" },
      performedAt: SEED_CREATED_AT,
    }),
    forwardOperation({
      id: "op_create_cus_b",
      orgId: ORG_ACME_ID,
      action: "create-customer",
      resourceType: "customer",
      resourceId: customerB.id,
      versionBefore: 0,
      versionAfter: 1,
      payload: createCustomerPayload(customerB),
      inverse: { type: "archive-customer" },
      performedAt: SEED_CREATED_AT,
    }),
    forwardOperation({
      id: "op_create_cus_archived",
      orgId: ORG_ACME_ID,
      action: "create-customer",
      resourceType: "customer",
      resourceId: customerArchived.id,
      versionBefore: 0,
      versionAfter: 1,
      payload: createCustomerPayload(customerArchived),
      inverse: { type: "archive-customer" },
      performedAt: SEED_CREATED_AT,
    }),
  ];

  return {
    orgId: ORG_ACME_ID,
    orgName: ORG_ACME_NAME,
    memberships: SEED_MEMBERSHIPS.filter((m) => m.orgId === ORG_ACME_ID),
    customers: [customerA, customerB, customerArchived],
    operations,
  };
}

export interface JobScenario {
  job: Job;
  operations: readonly Operation[];
}

/** `job_scheduled` on `cus_a`, still in its created state (blueprint B12). */
export function createScheduledJob(): JobScenario {
  const job = createJob({
    id: JOB_SCHEDULED_ID,
    orgId: ORG_ACME_ID,
    customerId: CUSTOMER_A_ID,
    title: JOB_SCHEDULED_TITLE,
    scheduledAt: JOB_SCHEDULED_AT,
    assignedTo: MEMBER1_EMAIL,
    createdBy: OWNER_EMAIL,
    now: SEED_CREATED_AT,
  });
  const operations = [
    forwardOperation({
      id: "op_create_job_scheduled",
      orgId: ORG_ACME_ID,
      action: "create-job",
      resourceType: "job",
      resourceId: job.id,
      versionBefore: 0,
      versionAfter: 1,
      payload: createJobPayload(job),
      inverse: { type: "archive-job" },
      performedAt: SEED_CREATED_AT,
    }),
  ];
  return { job, operations };
}

/** `job_in_progress` on `cus_a`: created, then started (blueprint B12:
 * version 1 → 2 via `start-job`). Not one of B12's four named builders, but
 * built the same way and for the same reason: the version, `updatedAt` and
 * inverse must come from the real domain functions, not be hand-typed. */
export function createInProgressJob(): JobScenario {
  const created = createJob({
    id: JOB_IN_PROGRESS_ID,
    orgId: ORG_ACME_ID,
    customerId: CUSTOMER_A_ID,
    title: JOB_IN_PROGRESS_TITLE,
    scheduledAt: JOB_IN_PROGRESS_SCHEDULED_AT,
    createdBy: OWNER_EMAIL,
    now: SEED_CREATED_AT,
  });
  const job = startJob(created, SEED_STARTED_AT);

  const operations = [
    forwardOperation({
      id: "op_create_job_in_progress",
      orgId: ORG_ACME_ID,
      action: "create-job",
      resourceType: "job",
      resourceId: created.id,
      versionBefore: 0,
      versionAfter: 1,
      payload: createJobPayload(created),
      inverse: { type: "archive-job" },
      performedAt: SEED_CREATED_AT,
    }),
    forwardOperation({
      id: "op_start_job_in_progress",
      orgId: ORG_ACME_ID,
      action: "start-job",
      resourceType: "job",
      resourceId: created.id,
      versionBefore: 1,
      versionAfter: 2,
      payload: {},
      inverse: statusBefore(created),
      performedAt: SEED_STARTED_AT,
    }),
  ];

  return { job, operations };
}

/** `job_completed` on `cus_b`: created, then completed directly from
 * `scheduled` (blueprint B12: version 1 → 2 via `complete-job`). */
export function createCompletedJob(): JobScenario {
  const created = createJob({
    id: JOB_COMPLETED_ID,
    orgId: ORG_ACME_ID,
    customerId: CUSTOMER_B_ID,
    title: JOB_COMPLETED_TITLE,
    scheduledAt: JOB_COMPLETED_SCHEDULED_AT,
    createdBy: OWNER_EMAIL,
    now: SEED_CREATED_AT,
  });
  const job = completeJob(created, SEED_COMPLETED_AT);

  const operations = [
    forwardOperation({
      id: "op_create_job_completed",
      orgId: ORG_ACME_ID,
      action: "create-job",
      resourceType: "job",
      resourceId: created.id,
      versionBefore: 0,
      versionAfter: 1,
      payload: createJobPayload(created),
      inverse: { type: "archive-job" },
      performedAt: SEED_CREATED_AT,
    }),
    forwardOperation({
      id: "op_complete_job_completed",
      orgId: ORG_ACME_ID,
      action: "complete-job",
      resourceType: "job",
      resourceId: created.id,
      versionBefore: 1,
      versionAfter: 2,
      payload: {},
      inverse: statusBefore(created),
      performedAt: SEED_COMPLETED_AT,
    }),
  ];

  return { job, operations };
}

/** `job_archived` on `cus_b`: created, then archived directly from
 * `scheduled` (blueprint B12: version 1 → 2, "create + archive op"). Not
 * one of B12's four named builders, built the same way as
 * `createInProgressJob` above. */
export function createArchivedJob(): JobScenario {
  const created = createJob({
    id: JOB_ARCHIVED_ID,
    orgId: ORG_ACME_ID,
    customerId: CUSTOMER_B_ID,
    title: JOB_ARCHIVED_TITLE,
    scheduledAt: JOB_ARCHIVED_SCHEDULED_AT,
    createdBy: OWNER_EMAIL,
    now: SEED_CREATED_AT,
  });
  const job = archiveJob(created, SEED_ARCHIVED_AT);

  const operations = [
    forwardOperation({
      id: "op_create_job_archived",
      orgId: ORG_ACME_ID,
      action: "create-job",
      resourceType: "job",
      resourceId: created.id,
      versionBefore: 0,
      versionAfter: 1,
      payload: createJobPayload(created),
      inverse: { type: "archive-job" },
      performedAt: SEED_CREATED_AT,
    }),
    forwardOperation({
      id: "op_archive_job_archived",
      orgId: ORG_ACME_ID,
      action: "archive-job",
      resourceType: "job",
      resourceId: created.id,
      versionBefore: 1,
      versionAfter: 2,
      payload: {},
      inverse: statusBefore(created),
      performedAt: SEED_ARCHIVED_AT,
    }),
  ];

  return { job, operations };
}

export interface ForeignOrganizationScenario {
  orgId: string;
  orgName: string;
  memberships: readonly SeedMembership[];
  customer: Customer;
  job: Job;
  operations: readonly Operation[];
}

/** `org_other`, its outsider owner, `cus_other` and `job_other` — the
 * cross-organization fixture every isolation test checks against
 * (blueprint B12). */
export function createForeignOrganizationJob(): ForeignOrganizationScenario {
  const customer = createCustomer({
    id: CUSTOMER_OTHER_ID,
    orgId: ORG_OTHER_ID,
    name: CUSTOMER_OTHER_NAME,
    createdBy: OUTSIDER_EMAIL,
    now: SEED_CREATED_AT,
  });
  const job = createJob({
    id: JOB_OTHER_ID,
    orgId: ORG_OTHER_ID,
    customerId: customer.id,
    title: JOB_OTHER_TITLE,
    scheduledAt: JOB_OTHER_SCHEDULED_AT,
    createdBy: OUTSIDER_EMAIL,
    now: SEED_CREATED_AT,
  });

  const operations = [
    forwardOperation({
      id: "op_create_cus_other",
      orgId: ORG_OTHER_ID,
      action: "create-customer",
      resourceType: "customer",
      resourceId: customer.id,
      versionBefore: 0,
      versionAfter: 1,
      payload: createCustomerPayload(customer),
      inverse: { type: "archive-customer" },
      performedAt: SEED_CREATED_AT,
    }),
    forwardOperation({
      id: "op_create_job_other",
      orgId: ORG_OTHER_ID,
      action: "create-job",
      resourceType: "job",
      resourceId: job.id,
      versionBefore: 0,
      versionAfter: 1,
      payload: createJobPayload(job),
      inverse: { type: "archive-job" },
      performedAt: SEED_CREATED_AT,
    }),
  ];

  return {
    orgId: ORG_OTHER_ID,
    orgName: ORG_OTHER_NAME,
    memberships: SEED_MEMBERSHIPS.filter((m) => m.orgId === ORG_OTHER_ID),
    customer,
    job,
    operations,
  };
}

/**
 * Loads the full B12 scenario into an `InMemoryDependencies`'s state:
 * memberships, customers, jobs and their creating (and, where the table
 * calls for it, transitioning) operations. Use-case tests call this once per
 * test and then act as one of the seeded users.
 */
export function seedInMemory(deps: InMemoryDependencies): void {
  const company = createCompanyWithMembers();
  const scheduled = createScheduledJob();
  const inProgress = createInProgressJob();
  const completed = createCompletedJob();
  const archived = createArchivedJob();
  const foreign = createForeignOrganizationJob();

  for (const membership of [...company.memberships, ...foreign.memberships]) {
    const org =
      deps.state.memberships.get(membership.orgId) ?? new Map<string, Role>();
    org.set(membership.email.toLowerCase(), membership.role);
    deps.state.memberships.set(membership.orgId, org);
  }

  for (const customer of [...company.customers, foreign.customer]) {
    deps.state.customers.set(customer.id, customer);
  }

  for (const job of [
    scheduled.job,
    inProgress.job,
    completed.job,
    archived.job,
    foreign.job,
  ]) {
    deps.state.jobs.set(job.id, job);
  }

  for (const operation of [
    ...company.operations,
    ...scheduled.operations,
    ...inProgress.operations,
    ...completed.operations,
    ...archived.operations,
    ...foreign.operations,
  ]) {
    deps.state.operations.set(operation.id, operation);
  }
}
