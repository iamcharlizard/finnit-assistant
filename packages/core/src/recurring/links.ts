import type { GqlRunner } from '../graphql/request';
import type { Localizer } from '../i18n/translator';
import {
  dayKeyOf,
  monthLabel,
  parseMonthParam,
  shortDate,
} from '../finance/dates';
import { formatMoney } from '../finance/money';
import { normalizeSearch } from '../text/option-search';

/**
 * "Ligar a gasto recurrente" from an expense's detail: every recurring
 * expense (subscriptions, memberships, services; loans have their own) with
 * its payment in each month around the expense's. The month is the
 * expense's by default and can be changed; the ones whose payment is due
 * near its day with a similar amount (the bank sync's rules) are suggested,
 * the best one selected; the rest can be searched. Linking pays that month's
 * payment (creating it when it wasn't generated, e.g. before the start
 * date), gives the expense the recurring expense's category and teaches the
 * expense its bank text, so the next syncs link by themselves.
 */
export type LinkSlotStatus =
  | 'pending'
  | 'missed'
  | 'paid_without_movement'
  | 'linked'
  | 'unscheduled';

export interface ApiRecurringLinkExpense {
  id: string;
  name: string;
  kind: string;
  amount: number;
  active: boolean;
  categoryId: string | null;
  nameMatches: boolean;
  fits: boolean;
  slots: {
    month: string;
    dueDate: string;
    status: LinkSlotStatus;
    expectedAmount: number;
  }[];
}

export interface ApiRecurringLinkOptions {
  month: string;
  months: string[];
  proposedId: string | null;
  expenses: ApiRecurringLinkExpense[];
}

export const RECURRING_LINK_OPTIONS_QUERY = `query RecurringLinkOptions($transactionId: ID!) {
  recurringLinkOptions(transactionId: $transactionId) {
    month months proposedId
    expenses { id name kind amount active categoryId nameMatches fits slots { month dueDate status expectedAmount } }
  }
}`;

export const LINK_RECURRING_MUTATION = `mutation LinkRecurringPayment($transactionId: ID!, $recurringExpenseId: ID!, $month: String) { linkRecurringPayment(transactionId: $transactionId, recurringExpenseId: $recurringExpenseId, month: $month) }`;

export interface RecurringLinkRow {
  id: string;
  /** "Netflix" */
  name: string;
  /** Its payment of the chosen month: "Vence el 15 oct · $142.33". */
  detail: string;
  /** Already paid with another movement that month. */
  disabled: boolean;
  /** Suggested for this expense (only in its own month). */
  suggested: boolean;
}

export interface RecurringLinkView {
  /** The months to choose, "Octubre 2026". */
  months: { value: string; label: string }[];
  suggested: RecurringLinkRow[];
  others: RecurringLinkRow[];
}

const SLOT_KEYS = {
  pending: 'transaction.linkRecurring.due',
  missed: 'transaction.linkRecurring.missed',
  paid_without_movement: 'transaction.linkRecurring.paidWithout',
  linked: 'transaction.linkRecurring.linked',
  unscheduled: 'transaction.linkRecurring.unscheduled',
} as const;

/**
 * The dialog for a month and a search: in the expense's own month (and
 * without a search) the suggested ones first; the rest by name. A search
 * looks through every recurring expense.
 */
export function toRecurringLinkView(
  options: ApiRecurringLinkOptions,
  month: string,
  query: string,
  currency: string,
  { locale, t }: Localizer,
): RecurringLinkView {
  const needle = normalizeSearch(query.trim());
  const ownMonth = month === options.month && !needle;
  const rows: RecurringLinkRow[] = options.expenses
    .filter((e) => !needle || normalizeSearch(e.name).includes(needle))
    .map((e) => {
      const slot = e.slots.find((s) => s.month === month);
      const detail = slot
        ? t(SLOT_KEYS[slot.status], {
            date: shortDate(dayKeyOf(slot.dueDate), locale),
            amount: formatMoney(slot.expectedAmount, currency, locale),
          })
        : formatMoney(e.amount, currency, locale);
      return {
        id: e.id,
        name: e.name,
        detail,
        disabled: slot?.status === 'linked',
        suggested: ownMonth && e.fits,
      };
    });
  return {
    months: options.months.map((m) => ({
      value: m,
      label: monthLabel(parseMonthParam(m, { year: 2000, month: 1 }), locale),
    })),
    suggested: rows.filter((r) => r.suggested),
    others: rows
      .filter((r) => !r.suggested)
      .sort((a, b) => (ownMonth ? 0 : a.name.localeCompare(b.name, locale))),
  };
}

/** Selected at first: the proposed one, in the expense's month. */
export function initialLinkChoice(options: ApiRecurringLinkOptions): {
  id: string | null;
  month: string;
} {
  return { id: options.proposedId, month: options.month };
}

export async function loadRecurringLinkOptions(
  transactionId: string,
  run: GqlRunner,
): Promise<ApiRecurringLinkOptions> {
  const data = await run<{ recurringLinkOptions: ApiRecurringLinkOptions }>(
    RECURRING_LINK_OPTIONS_QUERY,
    { transactionId },
  );
  return data.recurringLinkOptions;
}

export async function linkRecurringPayment(
  transactionId: string,
  recurringExpenseId: string,
  month: string,
  run: GqlRunner,
): Promise<void> {
  await run(LINK_RECURRING_MUTATION, {
    transactionId,
    recurringExpenseId,
    month,
  });
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
