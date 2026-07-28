import { randomInt } from 'node:crypto';

/** Inclusive bounds — a 6-digit id keeps the SMS footer short and typable. */
const MIN_MESSAGE_ID = 100_000;
const MAX_MESSAGE_ID = 999_999;

/**
 * A random 6-digit message id. Random rather than sequential so the number in
 * an alert SMS doesn't leak how many messages the service has handled.
 * Uniqueness is enforced by the primary key, not here — callers retry on
 * duplicate-key (see createIncomeMessage). The ~900k space only stays safe
 * because pruneOldMessages keeps the table bounded.
 */
export function randomMessageId(): number {
  return randomInt(MIN_MESSAGE_ID, MAX_MESSAGE_ID + 1); // upper bound exclusive
}
