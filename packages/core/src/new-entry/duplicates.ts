import type { SimilarTransaction } from './graphql';

/**
 * "¿Ya está registrado?": before creating a gasto or ingreso, the flow asks
 * the API for look-alikes (same account, amount and nearby date). When there
 * are any, the user picks one of them ("Es este") or creates it anyway.
 */
export type DuplicateCheck =
  | { kind: 'create' }
  | { kind: 'ask'; matches: SimilarTransaction[] };

export function duplicateCheck(
  matches: ReadonlyArray<SimilarTransaction> | null | undefined,
): DuplicateCheck {
  return matches && matches.length > 0
    ? { kind: 'ask', matches: [...matches] }
    : { kind: 'create' };
}

/** What follows the user's answer. */
export type DuplicatePlan =
  /** Create the new transaction (then upload the attachment, if any). */
  | { kind: 'create' }
  /** It was already there: attach the chosen file to it, then close. */
  | { kind: 'attachToExisting'; transactionId: string }
  /** It was already there and there is nothing to add: just close. */
  | { kind: 'close' };

export function planForDuplicateAnswer(
  answer: { kind: 'createAnyway' } | { kind: 'isThis'; transactionId: string },
  hasAttachment: boolean,
): DuplicatePlan {
  if (answer.kind === 'createAnyway') return { kind: 'create' };
  return hasAttachment
    ? { kind: 'attachToExisting', transactionId: answer.transactionId }
    : { kind: 'close' };
}
