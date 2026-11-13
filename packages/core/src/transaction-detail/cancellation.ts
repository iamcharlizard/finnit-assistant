/**
 * "Marcar como cancelado": a credit card movement the bank cancelled stays
 * in the history but counts nowhere. Before it, the movement's confirmed
 * statement is checked: a cancelled charge either isn't on it or is there
 * with its reversal; otherwise what the card owes in Finnit won't match.
 * Shared by the web and the mobile app.
 */
import type { GqlRunner } from '../graphql/request';
import { dayKeyOf, shortDate } from '../finance/dates';
import type { Localizer } from '../i18n/translator';

export const CANCEL_TRANSACTION_MUTATION = `mutation CancelTransaction($id: ID!) { cancelTransaction(id: $id) { id } }`;

export const RESTORE_TRANSACTION_MUTATION = `mutation RestoreTransaction($id: ID!) { restoreTransaction(id: $id) { id } }`;

export const CANCELLATION_CHECK_QUERY = `query CancellationCheck($id: ID!) { cancellationCheck(id: $id) { statementDate appears reversalFound } }`;

export interface CancellationCheck {
  /** The statement's cut-off (YYYY-MM-DD); null without one. */
  statementDate: string | null;
  /** On that statement; null without a statement. */
  appears: boolean | null;
  /** Its reversal (a credit of the same amount) is on that statement. */
  reversalFound: boolean;
}

export async function cancelTransaction(
  id: string,
  run: GqlRunner,
): Promise<void> {
  await run(CANCEL_TRANSACTION_MUTATION, { id });
}

export async function restoreTransaction(
  id: string,
  run: GqlRunner,
): Promise<void> {
  await run(RESTORE_TRANSACTION_MUTATION, { id });
}

/** The statement check; null when it can't be read (the generic note shows). */
export async function loadCancellationCheck(
  id: string,
  run: GqlRunner,
): Promise<CancellationCheck | null> {
  try {
    const data = await run<{ cancellationCheck: CancellationCheck }>(
      CANCELLATION_CHECK_QUERY,
      { id },
    );
    return data.cancellationCheck;
  } catch {
    return null;
  }
}

/**
 * What to tell before cancelling: the statement's word when there is one
 * (on it with its reversal, on it without one, or not on it), else a
 * reminder to check the statement.
 */
export function cancellationNote(
  check: CancellationCheck | null,
  { locale, t }: Localizer,
): string {
  if (!check?.statementDate || check.appears === null) {
    return t('transaction.cancel.verify');
  }
  const date = shortDate(dayKeyOf(check.statementDate), locale);
  if (!check.appears) return t('transaction.cancel.notOnStatement', { date });
  return check.reversalFound
    ? t('transaction.cancel.appearsWithReversal', { date })
    : t('transaction.cancel.appears', { date });
}
