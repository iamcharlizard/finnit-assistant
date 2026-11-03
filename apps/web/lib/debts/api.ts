import type { GqlRunner } from '@/lib/accounts/api';
import { requestErrorMessage } from '@/lib/graphql/client';
import type { Translate } from '@/lib/i18n/translator';
import {
  buildCreateDebtInput,
  buildUpdateDebtInput,
  type DebtForm,
  type PaymentMovement,
} from './form';
import { buildChargeInput, type ChargeForm } from './charge-form';
import { buildLoanInput, type LoanForm } from './loan-form';
import {
  LOAN_CANDIDATE_FIELDS,
  LOAN_DRAFT_FIELDS,
  PAYOFF_FIELDS,
  type ApiLoanDraft,
  type ApiLoanPaymentCandidate,
  type ApiPayoffProjection,
  type PayoffStrategy,
} from './types';

/** Debt mutations and the payoff plan, run from client components. */

export const CREATE_DEBT_MUTATION = `mutation CreateDebt($input: CreateDebtInput!) { createDebt(input: $input) { id } }`;

export const UPDATE_LOAN_MUTATION = `mutation UpdateLoan($id: ID!, $input: UpdateLoanInput!) { updateLoan(id: $id, input: $input) { id } }`;
export const UPDATE_DEBT_MUTATION = `mutation UpdateDebt($id: String!, $input: UpdateDebtInput!) { updateDebt(id: $id, input: $input) { id } }`;

export const DELETE_DEBT_MUTATION = `mutation DeleteDebt($id: String!) { deleteDebt(id: $id) }`;

export const CREATE_TRANSFER_MUTATION = `mutation CreateTransfer($input: CreateTransferInput!) { createTransfer(input: $input) { id fromTxnId } }`;

export const CREATE_DEBT_PAYMENT_MUTATION = `mutation CreateDebtPayment($input: CreateDebtPaymentInput!) { createDebtPayment(input: $input) { id } }`;

export const RECORD_DEBT_PAYMENT_MUTATION = `mutation RecordDebtPayment($input: RecordDebtPaymentInput!) { recordDebtPayment(input: $input) { id } }`;

export const ACCEPT_SUGGESTION_AS_LOAN_MUTATION = `mutation AcceptSuggestionAsLoan($fingerprint: ID!, $input: AcceptSuggestionAsLoanInput!) { acceptRecurringSuggestionAsLoan(fingerprint: $fingerprint, input: $input) { id name } }`;

export const LOAN_DRAFT_QUERY = `query LoanDraft($fingerprint: ID!) { recurringSuggestionLoanDraft(fingerprint: $fingerprint) { ${LOAN_DRAFT_FIELDS} } }`;

export const ADD_DEBT_CHARGE_MUTATION = `mutation AddDebtCharge($input: AddDebtChargeInput!) { addDebtCharge(input: $input) { id } }`;

export const UPDATE_DEBT_CHARGE_MUTATION = `mutation UpdateDebtCharge($id: ID!, $input: UpdateDebtChargeInput!) { updateDebtCharge(id: $id, input: $input) { id } }`;

export const DELETE_DEBT_CHARGE_MUTATION = `mutation DeleteDebtCharge($id: ID!) { deleteDebtCharge(id: $id) { id } }`;

export const DELETE_HISTORICAL_PAYMENT_MUTATION = `mutation DeleteHistoricalDebtPayment($id: ID!) { deleteHistoricalDebtPayment(id: $id) }`;

export const LOAN_CANDIDATES_QUERY = `query LoanPaymentCandidates($debtId: ID!) { loanPaymentCandidates(debtId: $debtId) { ${LOAN_CANDIDATE_FIELDS} } }`;

export const CONFIRM_LOAN_PAYMENT_MUTATION = `mutation ConfirmLoanPayment($occurrenceId: ID!, $transactionId: ID!) { confirmLoanPayment(occurrenceId: $occurrenceId, transactionId: $transactionId) { id } }`;

/** Both strategies in one request, with the same debts and extra payment. */
export const PAYOFF_COMPARISON_QUERY = `query PayoffComparison($avalanche: PayoffStrategyInput!, $snowball: PayoffStrategyInput!) {
  avalanche: payoffStrategy(input: $avalanche) { ${PAYOFF_FIELDS} }
  snowball: payoffStrategy(input: $snowball) { ${PAYOFF_FIELDS} }
}`;

export type DebtTarget =
  | { mode: 'create' }
  | { mode: 'edit'; id: string; initial: DebtForm };

/** Saves the dialog. Returns false when an edit changed nothing. */
export async function saveDebt(
  form: DebtForm,
  target: DebtTarget,
  run: GqlRunner,
): Promise<boolean> {
  if (target.mode === 'create') {
    await run(CREATE_DEBT_MUTATION, { input: buildCreateDebtInput(form) });
    return true;
  }
  const input = buildUpdateDebtInput(form, target.initial);
  if (!input) return false;
  await run(UPDATE_DEBT_MUTATION, { id: target.id, input });
  return true;
}

/** Saves the details tab; the API recomputes the terms if needed. */
export async function updateLoan(
  id: string,
  input: Record<string, unknown>,
  run: GqlRunner,
): Promise<void> {
  await run(UPDATE_LOAN_MUTATION, { id, input });
}

export async function deleteDebt(id: string, run: GqlRunner): Promise<void> {
  await run(DELETE_DEBT_MUTATION, { id });
}

/**
 * Saves a new loan, or a recurring suggestion as a loan (its detected
 * charges become paid installments). Returns the loan's id.
 */
export async function saveLoan(
  form: LoanForm,
  fingerprint: string | null,
  run: GqlRunner,
): Promise<string> {
  const input = buildLoanInput(form);
  if (fingerprint) {
    const data = await run<{ acceptRecurringSuggestionAsLoan: { id: string } }>(
      ACCEPT_SUGGESTION_AS_LOAN_MUTATION,
      { fingerprint, input },
    );
    return data.acceptRecurringSuggestionAsLoan.id;
  }
  const data = await run<{ createDebt: { id: string } }>(CREATE_DEBT_MUTATION, {
    input,
  });
  return data.createDebt.id;
}

/** The loan the AI and the detected charges propose for a suggestion. */
export async function loadLoanDraft(
  fingerprint: string,
  run: GqlRunner,
): Promise<ApiLoanDraft> {
  const data = await run<{ recurringSuggestionLoanDraft: ApiLoanDraft }>(
    LOAN_DRAFT_QUERY,
    { fingerprint },
  );
  return data.recurringSuggestionLoanDraft;
}

export async function addDebtCharge(
  form: ChargeForm,
  debtId: string,
  run: GqlRunner,
): Promise<void> {
  await run(ADD_DEBT_CHARGE_MUTATION, {
    input: buildChargeInput(form, debtId),
  });
}

export async function updateDebtCharge(
  form: ChargeForm,
  id: string,
  run: GqlRunner,
): Promise<void> {
  await run(UPDATE_DEBT_CHARGE_MUTATION, { id, input: buildChargeInput(form) });
}

export async function deleteDebtCharge(
  id: string,
  run: GqlRunner,
): Promise<void> {
  await run(DELETE_DEBT_CHARGE_MUTATION, { id });
}

export async function deleteHistoricalPayment(
  id: string,
  run: GqlRunner,
): Promise<void> {
  await run(DELETE_HISTORICAL_PAYMENT_MUTATION, { id });
}

export async function loadLoanCandidates(
  debtId: string,
  run: GqlRunner,
): Promise<ApiLoanPaymentCandidate[]> {
  const data = await run<{ loanPaymentCandidates: ApiLoanPaymentCandidate[] }>(
    LOAN_CANDIDATES_QUERY,
    { debtId },
  );
  return data.loanPaymentCandidates;
}

export async function confirmLoanPayment(
  candidate: Pick<ApiLoanPaymentCandidate, 'occurrenceId' | 'transactionId'>,
  run: GqlRunner,
): Promise<void> {
  await run(CONFIRM_LOAN_PAYMENT_MUTATION, {
    occurrenceId: candidate.occurrenceId,
    transactionId: candidate.transactionId,
  });
}

/**
 * The transfer was saved but couldn't be linked to the debt. The API
 * doesn't delete transfers, so it stays and the message says so.
 */
export class PaymentLinkError extends Error {
  constructor(readonly reason: unknown) {
    super((reason as { message?: string } | null)?.message ?? 'Link failed');
    this.name = 'PaymentLinkError';
  }
}

/**
 * Records a payment (see paymentMode).
 * - An expense: one call that saves the movement, the debt payment and the
 *   scheduled payment it pays (the oldest open one unless `occurrenceId`),
 *   all or nothing.
 * - A transfer to the linked card: the transfer first, then the debt payment
 *   that points at it (createDebtPayment needs an existing transaction).
 */
export async function registerDebtPayment(
  debtId: string,
  movement: PaymentMovement,
  run: GqlRunner,
  { occurrenceId }: { occurrenceId?: string } = {},
): Promise<void> {
  if (movement.kind === 'expense') {
    const { input } = movement;
    await run(RECORD_DEBT_PAYMENT_MUTATION, {
      input: {
        debtId,
        accountId: input.accountId,
        amount: input.amount,
        date: input.txnDate,
        ...(input.categoryId && { categoryId: input.categoryId }),
        ...(occurrenceId && { occurrenceId }),
      },
    });
    return;
  }

  const data = await run<{ createTransfer: { fromTxnId: string } }>(
    CREATE_TRANSFER_MUTATION,
    { input: movement.input },
  );
  try {
    await run(CREATE_DEBT_PAYMENT_MUTATION, {
      input: {
        debtId,
        transactionId: data.createTransfer.fromTxnId,
        amount: movement.input.amount,
        date: movement.input.txnDate,
      },
    });
  } catch (error) {
    throw new PaymentLinkError(error);
  }
}

export async function loadPayoffComparison(
  debtIds: string[],
  extraPayment: number,
  run: GqlRunner,
): Promise<Record<PayoffStrategy, ApiPayoffProjection[]>> {
  return run<Record<PayoffStrategy, ApiPayoffProjection[]>>(
    PAYOFF_COMPARISON_QUERY,
    {
      avalanche: { debtIds, extraPayment, strategy: 'avalanche' },
      snowball: { debtIds, extraPayment, strategy: 'snowball' },
    },
  );
}

/** API messages are English; show ours in the user's language. */
const MESSAGES: [RegExp, Parameters<Translate>[0]][] = [
  [/cannot delete debt with existing payments/i, 'debts.errors.hasPayments'],
  [/unique constraint/i, 'debts.errors.duplicateName'],
  [/exceeds remaining debt balance/i, 'debts.errors.overpayment'],
  [/insufficient balance/i, 'debts.errors.insufficientBalance'],
  [/currency conversion/i, 'debts.errors.currency'],
  [/linked account not found/i, 'debts.errors.account'],
  [/principal cannot be less/i, 'debts.errors.principalBelowPaid'],
  [/debt not found/i, 'debts.errors.notFound'],
  [/exceed the (new )?amount to repay/i, 'debts.errors.paidTooMuch'],
  [/total to repay cannot be less/i, 'debts.errors.totalBelowPrincipal'],
  [
    /cannot be less than the payments already made/i,
    'debts.errors.installmentsBelowPaid',
  ],
  [
    /first payment date is too late|give the first payment date/i,
    'debts.errors.firstPaymentTooLate',
  ],
  [/recurring suggestion not found/i, 'debts.errors.suggestionGone'],
  [
    /already pays something else|already marked as paid/i,
    'debts.errors.candidateTaken',
  ],
  [/already exists/i, 'debts.errors.duplicateName'],
  [/deposit account not found|account not found/i, 'debts.errors.account'],
  [/choose the payment frequency/i, 'debts.errors.frequency'],
  [/has a fixed payment/i, 'debts.errors.fixedPayment'],
  [/first payment cannot be before/i, 'debts.errors.firstPaymentAfterDate'],
  [
    /payments already made cannot exceed the number/i,
    'debts.errors.installmentsPaidCount',
  ],
];

export function debtErrorMessage(error: unknown, t: Translate): string {
  const cause = error instanceof PaymentLinkError ? error.reason : error;
  const message = (cause as { message?: string } | null)?.message ?? '';
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  const text = known
    ? t(known[1])
    : (cause as { code?: string } | null)?.code === 'INTERNAL_SERVER_ERROR'
      ? t('errors.unexpected')
      : requestErrorMessage(cause, t);
  if (error instanceof PaymentLinkError) {
    return t('debts.errors.paymentNotLinked', { reason: text });
  }
  return text;
}
