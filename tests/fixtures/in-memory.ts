/**
 * In-memory implementation of `Dependencies` (blueprint B7, B11).
 *
 * Every use-case test builds one of these instead of touching D1: the
 * behaviour mirrors the real repositories closely enough that a use case
 * cannot tell the difference — `getById`/`list` filter by `orgId`, job
 * creation requires an active customer in the same org, `commit` is
 * version-guarded and CONFLICTs on a stale version, and the clock and id
 * generator are both fixed so tests stay deterministic.
 *
 * `state` is exposed directly so tests (and `tests/fixtures/scenario.ts`)
 * can seed or inspect it without going through the repository interfaces,
 * which run the same preconditions a real adapter would.
 */

import type { Role } from "../../src/application/authorization";
import { AppError } from "../../src/application/errors";
import type {
  Clock,
  CustomerRepository,
  Dependencies,
  IdempotencyStore,
  IdGenerator,
  JobRepository,
  MembershipReader,
  OperationRepository,
} from "../../src/application/ports";
import type { ExternalAccountingSystem } from "../../src/application/ports/external-accounting";
import type { Customer, Job, Operation, ResourceType } from "../../src/domain";

/** The clock value every `createInMemoryDependencies()` call uses unless
 * `options.now` overrides it — "today" in this fixture's fictional
 * timeline, and the same instant every other fixed constant in the codebase
 * (blueprint B12) is written against. */
const DEFAULT_NOW = "2026-09-06T12:00:00.000Z";

export interface InMemoryState {
  customers: Map<string, Customer>;
  jobs: Map<string, Job>;
  operations: Map<string, Operation>;
  /** Keyed by `orgId`, `action` and `key` joined with a space (see
   * `idempotencyMapKey` below) → the resourceId that call created. */
  idempotency: Map<string, string>;
  /** orgId → (lower-cased email → role). */
  memberships: Map<string, Map<string, Role>>;
}

export interface InMemoryDependenciesOptions {
  /** Fixed `Clock.now()` value. Defaults to `DEFAULT_NOW`. */
  now?: string;
  /** Fixed sequence for `IdGenerator.next()`. Defaults to `id-1`, `id-2`, …
   * Throws once the sequence is exhausted rather than silently falling back,
   * so a test that asserts on ids notices an unexpected extra call. */
  ids?: string[];
}

export interface InMemoryDependencies extends Dependencies {
  state: InMemoryState;
}

function idempotencyMapKey(orgId: string, action: string, key: string): string {
  return `${orgId} ${action} ${key}`;
}

function createClock(now: string): Clock {
  return { now: () => now };
}

function createIdGenerator(fixedIds: string[] | undefined): IdGenerator {
  let sequence = 0;
  return {
    next: () => {
      sequence += 1;
      if (fixedIds) {
        const id = fixedIds[sequence - 1];
        if (id === undefined) {
          throw new Error(
            `in-memory id generator: no id provided for call #${sequence}`,
          );
        }
        return id;
      }
      return `id-${sequence}`;
    },
  };
}

function createMembershipReader(state: InMemoryState): MembershipReader {
  return {
    getRole: async (orgId, userEmail) => {
      const org = state.memberships.get(orgId);
      if (!org) return null;
      return org.get(userEmail.toLowerCase()) ?? null;
    },
    isMember: async (orgId, userEmail) => {
      const org = state.memberships.get(orgId);
      return org ? org.has(userEmail.toLowerCase()) : false;
    },
  };
}

function applyMarkUndone(
  state: InMemoryState,
  markUndone: string | undefined,
  undoneBy: string,
): void {
  if (!markUndone) return;
  const op = state.operations.get(markUndone);
  if (op)
    state.operations.set(markUndone, { ...op, undoneByOperationId: undoneBy });
}

function createCustomerRepository(state: InMemoryState): CustomerRepository {
  return {
    getById: async (orgId, id) => {
      const found = state.customers.get(id);
      return found && found.orgId === orgId ? found : null;
    },
    list: async (orgId, filter) => {
      return Array.from(state.customers.values())
        .filter((c) => c.orgId === orgId)
        .filter((c) => (filter.status ? c.status === filter.status : true))
        .filter((c) =>
          filter.search
            ? c.name.toLowerCase().includes(filter.search.toLowerCase())
            : true,
        );
    },
    create: async ({ customer, operation, idempotency }) => {
      state.customers.set(customer.id, customer);
      state.operations.set(operation.id, operation);
      if (idempotency) {
        state.idempotency.set(
          idempotencyMapKey(
            customer.orgId,
            idempotency.action,
            idempotency.key,
          ),
          customer.id,
        );
      }
    },
    commit: async ({ customer, expectedVersion, operation, markUndone }) => {
      const existing = state.customers.get(customer.id);
      if (
        !existing ||
        existing.orgId !== customer.orgId ||
        existing.version !== expectedVersion
      ) {
        throw new AppError(
          "CONFLICT",
          "The record was changed by someone else",
        );
      }
      state.customers.set(customer.id, customer);
      state.operations.set(operation.id, operation);
      applyMarkUndone(state, markUndone, operation.id);
    },
  };
}

function createJobRepository(state: InMemoryState): JobRepository {
  return {
    getById: async (orgId, id) => {
      const found = state.jobs.get(id);
      return found && found.orgId === orgId ? found : null;
    },
    list: async (orgId, filter) => {
      return (
        Array.from(state.jobs.values())
          .filter((j) => j.orgId === orgId)
          .filter((j) => (filter.status ? j.status === filter.status : true))
          .filter((j) =>
            filter.customerId ? j.customerId === filter.customerId : true,
          )
          // Half-open window, the same as `SELECT_JOBS_PARTS` in
          // `src/infrastructure/d1/sql.ts`: `from` inclusive, `to` exclusive.
          .filter((j) => (filter.from ? j.scheduledAt >= filter.from : true))
          .filter((j) => (filter.to ? j.scheduledAt < filter.to : true))
      );
    },
    create: async ({ job, operation, idempotency }) => {
      const customer = state.customers.get(job.customerId);
      if (
        !customer ||
        customer.orgId !== job.orgId ||
        customer.status !== "active"
      ) {
        throw new AppError("NOT_FOUND", "Customer not found or archived");
      }
      state.jobs.set(job.id, job);
      state.operations.set(operation.id, operation);
      if (idempotency) {
        state.idempotency.set(
          idempotencyMapKey(job.orgId, idempotency.action, idempotency.key),
          job.id,
        );
      }
    },
    commit: async ({ job, expectedVersion, operation, markUndone }) => {
      const existing = state.jobs.get(job.id);
      if (
        !existing ||
        existing.orgId !== job.orgId ||
        existing.version !== expectedVersion
      ) {
        throw new AppError(
          "CONFLICT",
          "The record was changed by someone else",
        );
      }
      state.jobs.set(job.id, job);
      state.operations.set(operation.id, operation);
      applyMarkUndone(state, markUndone, operation.id);
    },
  };
}

/** Newest first, matching what "recent activity" means for both
 * `listRecent` and `listForResource`. */
function byMostRecentFirst(a: Operation, b: Operation): number {
  if (a.performedAt === b.performedAt) return 0;
  return a.performedAt < b.performedAt ? 1 : -1;
}

function createOperationRepository(state: InMemoryState): OperationRepository {
  return {
    getById: async (orgId, id) => {
      const found = state.operations.get(id);
      return found && found.orgId === orgId ? found : null;
    },
    listRecent: async (orgId, limit) => {
      return Array.from(state.operations.values())
        .filter((op) => op.orgId === orgId)
        .sort(byMostRecentFirst)
        .slice(0, limit);
    },
    listForResource: async (
      orgId: string,
      type: ResourceType,
      id: string,
      limit: number,
    ) => {
      return Array.from(state.operations.values())
        .filter(
          (op) =>
            op.orgId === orgId &&
            op.resourceType === type &&
            op.resourceId === id,
        )
        .sort(byMostRecentFirst)
        .slice(0, limit);
    },
  };
}

function createIdempotencyStore(state: InMemoryState): IdempotencyStore {
  return {
    find: async (orgId, action, key) => {
      return (
        state.idempotency.get(idempotencyMapKey(orgId, action, key)) ?? null
      );
    },
  };
}

/**
 * Trivial stand-in for the real vendor adapter (blueprint B22), just enough
 * to make `Dependencies` complete for tests that do not exercise
 * `sendJobToAccounting` themselves. T27 adds the real, independently tested
 * mock at `src/infrastructure/mock/mock-accounting.ts`.
 */
function createInMemoryAccounting(): ExternalAccountingSystem {
  const seenKeys = new Set<string>();
  return {
    createInvoiceDraft: async ({ idempotencyKey, job }) => {
      const alreadyExisted = seenKeys.has(idempotencyKey);
      seenKeys.add(idempotencyKey);
      return { externalReference: `ACC-${job.id}`, alreadyExisted };
    },
  };
}

export function createInMemoryDependencies(
  options: InMemoryDependenciesOptions = {},
): InMemoryDependencies {
  const state: InMemoryState = {
    customers: new Map(),
    jobs: new Map(),
    operations: new Map(),
    idempotency: new Map(),
    memberships: new Map(),
  };

  return {
    clock: createClock(options.now ?? DEFAULT_NOW),
    ids: createIdGenerator(options.ids),
    membership: createMembershipReader(state),
    customers: createCustomerRepository(state),
    jobs: createJobRepository(state),
    operations: createOperationRepository(state),
    idempotency: createIdempotencyStore(state),
    accounting: createInMemoryAccounting(),
    state,
  };
}
