import type { GqlRunner } from '../graphql/request';
import type { Localizer } from '../i18n/translator';
import { dayKeyOf, shortDate } from '../finance/dates';
import { formatMoney } from '../finance/money';

/**
 * "Ligar a gasto recurrente" from an expense's detail: the scheduled
 * payments (subscriptions, memberships, services; loans have their own) it
 * may have paid: due near its day with a similar amount (the bank sync's
 * rules), pending, missed or paid without a movement. Linking marks that
 * payment paid, gives the expense the recurring expense's category and
 * teaches the expense its bank text, so the next syncs link by themselves.
 */
export interface ApiRecurringLinkOption {
  occurrenceId: string;
  recurringExpenseId: string;
  name: string;
  kind: string;
  dueDate: string;
  expectedAmount: number;
  status: 'upcoming' | 'missed' | 'paid' | 'skipped';
  categoryId: string | null;
  proposed: boolean;
}

export const RECURRING_LINK_OPTIONS_QUERY = `query RecurringLinkOptions($transactionId: ID!) {
  recurringLinkOptions(transactionId: $transactionId) { occurrenceId recurringExpenseId name kind dueDate expectedAmount status categoryId proposed }
}`;

export const LINK_RECURRING_MUTATION = `mutation LinkRecurringPayment($transactionId: ID!, $occurrenceId: ID!) { linkRecurringPayment(transactionId: $transactionId, occurrenceId: $occurrenceId) }`;

export interface RecurringLinkOptionView {
  occurrenceId: string;
  /** "Netflix" */
  name: string;
  /** "Vence el 7 nov · $219.00" (or "Vencido …") */
  detail: string;
  proposed: boolean;
}

export function toRecurringLinkOptions(
  options: ReadonlyArray<ApiRecurringLinkOption>,
  currency: string,
  { locale, t }: Localizer,
): { options: RecurringLinkOptionView[]; initial: string | null } {
  return {
    options: options.map((o) => ({
      occurrenceId: o.occurrenceId,
      name: o.name,
      detail: t(
        o.status === 'missed'
          ? 'transaction.linkRecurring.missed'
          : o.status === 'paid'
            ? 'transaction.linkRecurring.paidWithout'
            : 'transaction.linkRecurring.due',
        {
          date: shortDate(dayKeyOf(o.dueDate), locale),
          amount: formatMoney(o.expectedAmount, currency, locale),
        },
      ),
      proposed: o.proposed,
    })),
    initial: options.find((o) => o.proposed)?.occurrenceId ?? null,
  };
}

export async function loadRecurringLinkOptions(
  transactionId: string,
  run: GqlRunner,
): Promise<ApiRecurringLinkOption[]> {
  const data = await run<{ recurringLinkOptions: ApiRecurringLinkOption[] }>(
    RECURRING_LINK_OPTIONS_QUERY,
    { transactionId },
  );
  return data.recurringLinkOptions;
}

export async function linkRecurringPayment(
  transactionId: string,
  occurrenceId: string,
  run: GqlRunner,
): Promise<void> {
  await run(LINK_RECURRING_MUTATION, { transactionId, occurrenceId });
}

/** The movement as the dialog's description names it: "7 nov", "$219.00". */
export function linkIntro(
  tx: { amount: number; currency: string; txnDate: string },
  { locale }: Pick<Localizer, 'locale'>,
): { date: string; amount: string } {
  return {
    date: shortDate(dayKeyOf(tx.txnDate), locale),
    amount: formatMoney(Math.abs(tx.amount), tx.currency, locale),
  };
}
