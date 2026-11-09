/**
 * "¿Ya está registrado?" for a new transfer: movements already recorded in
 * the source (money leaving) and the destination (money arriving) with the
 * same amount, a few days around its date. Using one makes it that side of
 * the transfer instead of creating a copy (e.g. the bank already brought the
 * deposit). Pure: the web and the app run the query with their own client.
 */
import { TRANSACTION_FIELDS, type ApiTransaction } from '../finance/types';
import { parseAmount } from '../new-entry/form';
import type { DayKey } from '../finance/dates';

export const TRANSFER_LEG_CANDIDATES_QUERY = `query TransferLegCandidates($fromAccountId: ID!, $toAccountId: ID!, $amount: Float!, $date: DateTime) {
  transferLegCandidates(fromAccountId: $fromAccountId, toAccountId: $toAccountId, amount: $amount, date: $date) {
    from { ${TRANSACTION_FIELDS} }
    to { ${TRANSACTION_FIELDS} }
  }
}`;

export interface TransferLegCandidates {
  from: ApiTransaction[];
  to: ApiTransaction[];
}

/** The query's variables, or null while the draft can't be searched yet. */
export function legCandidatesArgs(draft: {
  fromAccountId: string | null;
  toAccountId: string | null;
  amount: string;
  date: DayKey | null;
}): {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: DayKey | null;
} | null {
  const amount = parseAmount(draft.amount);
  if (
    !draft.fromAccountId ||
    !draft.toAccountId ||
    draft.fromAccountId === draft.toAccountId ||
    !amount ||
    amount <= 0
  ) {
    return null;
  }
  return {
    fromAccountId: draft.fromAccountId,
    toAccountId: draft.toAccountId,
    amount,
    date: draft.date,
  };
}

/**
 * Which recorded movement each side uses: the user's pick while it is
 * still offered; otherwise the only candidate (a clear match); otherwise
 * none (a new one is created).
 */
export function legChoice(
  candidates: ReadonlyArray<{ id: string }>,
  picked: string | null | undefined,
): string | null {
  if (picked === NEW_LEG) return null;
  if (picked && candidates.some((c) => c.id === picked)) return picked;
  return candidates.length === 1 ? candidates[0]!.id : null;
}

/** The "Crear uno nuevo" choice. */
export const NEW_LEG = 'new';
