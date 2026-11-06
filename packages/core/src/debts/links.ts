/**
 * Linking an expense movement to a payment of a loan, from either side:
 * the movement's detail (pick the loan and the payment; the one due the
 * movement's day comes suggested) or the loan's detail (pick among the
 * movements close in amount and naming the loan). Shared by the web and
 * the mobile app.
 */
import type { GqlRunner } from '../graphql/request';
import { dayKeyOf, fullDate, longDate, type DayKey } from '../finance/dates';
import { DEFAULT_CURRENCY, formatMoney } from '../finance/money';
import type { Localizer } from '../i18n/translator';

export type LinkTargetState = 'open' | 'overdue' | 'paid_without_movement';

export interface ApiLoanLinkTarget {
  occurrenceId: string;
  dueDate: string;
  amount: number;
  state: LinkTargetState;
}

export interface ApiLoanLinkLoan {
  debtId: string;
  name: string;
  lenderName: string | null;
  suggestedOccurrenceId: string | null;
  payments: ApiLoanLinkTarget[];
}

export interface ApiLoanLinkOptions {
  suggestedDebtId: string | null;
  loans: ApiLoanLinkLoan[];
}

export interface ApiLoanExpenseCandidate {
  transactionId: string;
  date: string;
  amount: number;
  description: string;
  accountName: string;
  nameMatch: boolean;
  exactAmount: boolean;
  score: number;
}

export const LOAN_LINK_OPTIONS_QUERY = `query LoanLinkOptions($transactionId: ID!) {
  loanLinkOptions(transactionId: $transactionId) {
    suggestedDebtId
    loans { debtId name lenderName suggestedOccurrenceId payments { occurrenceId dueDate amount state } }
  }
}`;

export const LOAN_EXPENSE_CANDIDATES_QUERY = `query LoanExpenseCandidates($occurrenceId: ID!, $search: String) {
  loanExpenseCandidates(occurrenceId: $occurrenceId, search: $search) {
    transactionId date amount description accountName nameMatch exactAmount score
  }
}`;

export const LINK_LOAN_PAYMENT_MUTATION = `mutation LinkLoanPayment($occurrenceId: ID!, $transactionId: ID!) { linkLoanPayment(occurrenceId: $occurrenceId, transactionId: $transactionId) { id } }`;

export const UNLINK_LOAN_PAYMENT_MUTATION = `mutation UnlinkLoanPayment($occurrenceId: ID!, $keepPaid: Boolean!) { unlinkLoanPayment(occurrenceId: $occurrenceId, keepPaid: $keepPaid) { id } }`;

export async function loadLoanLinkOptions(
  transactionId: string,
  run: GqlRunner,
): Promise<ApiLoanLinkOptions> {
  const data = await run<{ loanLinkOptions: ApiLoanLinkOptions }>(
    LOAN_LINK_OPTIONS_QUERY,
    { transactionId },
  );
  return data.loanLinkOptions;
}

export async function loadLoanExpenseCandidates(
  occurrenceId: string,
  search: string | null,
  run: GqlRunner,
): Promise<ApiLoanExpenseCandidate[]> {
  const data = await run<{ loanExpenseCandidates: ApiLoanExpenseCandidate[] }>(
    LOAN_EXPENSE_CANDIDATES_QUERY,
    { occurrenceId, search: search?.trim() || null },
  );
  return data.loanExpenseCandidates;
}

export async function linkLoanPayment(
  occurrenceId: string,
  transactionId: string,
  run: GqlRunner,
): Promise<void> {
  await run(LINK_LOAN_PAYMENT_MUTATION, { occurrenceId, transactionId });
}

export async function unlinkLoanPayment(
  occurrenceId: string,
  keepPaid: boolean,
  run: GqlRunner,
): Promise<void> {
  await run(UNLINK_LOAN_PAYMENT_MUTATION, { occurrenceId, keepPaid });
}

/** One payment the movement can pay, as the picker lists it. */
export interface LinkTargetRow {
  occurrenceId: string;
  dueDate: DayKey;
  /** With the year. */
  dateLabel: string;
  amountLabel: string;
  state: LinkTargetState;
  suggested: boolean;
}

export interface LinkLoanRow {
  debtId: string;
  /** "Préstamo DiDi · DiDi" */
  label: string;
  payments: LinkTargetRow[];
  suggestedOccurrenceId: string | null;
}

export interface LinkOptionsView {
  loans: LinkLoanRow[];
  /** What the picker starts on. */
  initialDebtId: string | null;
  initialOccurrenceId: string | null;
}

export function buildLinkOptionsView(
  options: ApiLoanLinkOptions,
  { locale }: Pick<Localizer, 'locale'>,
): LinkOptionsView {
  const money = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  const loans = options.loans.map(
    (loan): LinkLoanRow => ({
      debtId: loan.debtId,
      label:
        loan.lenderName && loan.lenderName !== loan.name
          ? `${loan.name} · ${loan.lenderName}`
          : loan.name,
      suggestedOccurrenceId: loan.suggestedOccurrenceId,
      payments: loan.payments.map((p) => {
        const day = dayKeyOf(p.dueDate);
        return {
          occurrenceId: p.occurrenceId,
          dueDate: day,
          dateLabel: fullDate(day, locale),
          amountLabel: money(p.amount),
          state: p.state,
          suggested: p.occurrenceId === loan.suggestedOccurrenceId,
        };
      }),
    }),
  );
  const initial =
    loans.find((l) => l.debtId === options.suggestedDebtId) ??
    (loans.length === 1 ? loans[0] : undefined);
  return {
    loans,
    initialDebtId: initial?.debtId ?? null,
    initialOccurrenceId: initial ? initialPaymentOf(initial) : null,
  };
}

/** The suggested payment, else the only one there is. */
export function initialPaymentOf(loan: LinkLoanRow): string | null {
  return (
    loan.suggestedOccurrenceId ??
    (loan.payments.length === 1 ? loan.payments[0]!.occurrenceId : null)
  );
}

/** One movement the payment can take, as the picker lists it. */
export interface ExpenseCandidateRow {
  transactionId: string;
  description: string;
  /** "3 de noviembre · Mi Cuenta" */
  meta: string;
  amountLabel: string;
  nameMatch: boolean;
  exactAmount: boolean;
}

export function buildExpenseCandidateRows(
  candidates: ApiLoanExpenseCandidate[],
  today: DayKey,
  { locale }: Pick<Localizer, 'locale'>,
): ExpenseCandidateRow[] {
  return candidates.map((c) => ({
    transactionId: c.transactionId,
    description: c.description,
    meta: [longDate(dayKeyOf(c.date), today, locale), c.accountName].join(
      ' · ',
    ),
    amountLabel: formatMoney(c.amount, DEFAULT_CURRENCY, locale),
    nameMatch: c.nameMatch,
    exactAmount: c.exactAmount,
  }));
}
