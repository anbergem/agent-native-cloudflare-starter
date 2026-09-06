/**
 * The three things every command use case shares (blueprint B8).
 *
 * The seven command files are otherwise self-contained, but these three would
 * be copied verbatim into all of them, and two of them are the kind of thing
 * that must never drift between copies: what a command returns, and how a
 * duplicate idempotency key is recognised.
 */

import { toAppError } from "../errors";

/** What every command returns: the resource as it now is, and the id of the
 * operation row that records the change — the handle `undo-operation` takes. */
export interface CommandResult<T> {
  resource: T;
  operationId: string;
}

/**
 * Runs a pure domain transition and converts its `DomainError` into the
 * matching `AppError` (`VALIDATION` → `VALIDATION`, `INVARIANT` →
 * `INVARIANT`), so a use case only ever throws `AppError` and a test can
 * assert on one error type. Anything that is not a `DomainError` becomes
 * `INTERNAL` with its message withheld, exactly as `runAppAction` would.
 */
export function applyDomain<T>(transition: () => T): T {
  try {
    return transition();
  } catch (err) {
    throw toAppError(err);
  }
}

/**
 * Whether a failed create looks like a lost race on the same idempotency key
 * (blueprint B8, decision D14).
 *
 * Two callers can pass the `find` lookup at the same time and both go on to
 * write; the `idempotency_keys` primary key `(org_id, action, key)` lets only
 * one of them land, and the loser's whole atomic batch is rolled back. The
 * loser must then answer with the resource the winner created, not with a
 * database error, so it retries the lookup once.
 *
 * The match is on the message because the driver's error shape is not part of
 * the port contract: `@libsql/client` reports the violation as
 * `SQLITE_CONSTRAINT_PRIMARYKEY: UNIQUE constraint failed:
 * idempotency_keys.org_id, idempotency_keys.action, idempotency_keys.key`.
 * Being broad is safe here: the caller only acts on `true` when the retried
 * lookup actually finds a resource, so a false positive costs one extra read
 * and then rethrows the original error.
 */
export function isIdempotencyKeyViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("idempotency_keys") ||
    message.includes("UNIQUE") ||
    message.includes("PRIMARY KEY")
  );
}

/**
 * How far back `listForResource` is asked to look for a resource's creating
 * operation when an idempotent create replays (blueprint B8).
 *
 * The port returns operations newest first, and the create is the oldest one,
 * so a resource with more than this many operations since would hide it. A
 * replay is a retry of a call that just happened, so in practice the create is
 * the only row there; see `docs/plan/DISCREPANCIES.md` for the case this does
 * not cover.
 */
export const CREATE_OPERATION_LOOKUP_LIMIT = 100;
