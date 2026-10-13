import type { GqlRunner } from '@/lib/accounts/api';
import { requestErrorMessage } from '@/lib/graphql/client';
import type { Translate } from '@/lib/i18n/translator';
import {
  buildCreateDebtInput,
  buildUpdateDebtInput,
  type DebtForm,
  type PaymentMovement,
} from './form';
import {
  PAYOFF_FIELDS,
  type ApiPayoffProjection,
  type PayoffStrategy,
} from './types';

/** Debt mutations and the payoff plan, run from client components. */

export const CREATE_DEBT_MUTATION = `mutation CreateDebt($input: CreateDebtInput!) { createDebt(input: $input) { id } }`;

export const UPDATE_DEBT_MUTATION = `mutation UpdateDebt($id: String!, $input: UpdateDebtInput!) { updateDebt(id: $id, input: $input) { id } }`;

export const DELETE_DEBT_MUTATION = `mutation DeleteDebt($id: String!) { deleteDebt(id: $id) }`;

export const CREATE_EXPENSE_MUTATION = `mutation CreateTransaction($input: CreateTransactionInput!) { createTransaction(input: $input) { id } }`;

export const CREATE_TRANSFER_MUTATION = `mutation CreateTransfer($input: CreateTransferInput!) { createTransfer(input: $input) { id fromTxnId } }`;

export const DELETE_TRANSACTION_MUTATION = `mutation DeleteTransaction($id: String!) { deleteTransaction(id: $id) }`;

export const CREATE_DEBT_PAYMENT_MUTATION = `mutation CreateDebtPayment($input: CreateDebtPaymentInput!) { createDebtPayment(input: $input) { id } }`;

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

export async function deleteDebt(id: string, run: GqlRunner): Promise<void> {
  await run(DELETE_DEBT_MUTATION, { id });
}

/**
 * The movement was saved but couldn't be linked to the debt. `undone` says
 * whether the movement was removed again (an expense can be; a transfer
 * can't, the API doesn't delete transfers).
 */
export class PaymentLinkError extends Error {
  constructor(
    readonly reason: unknown,
    readonly undone: boolean,
  ) {
    super((reason as { message?: string } | null)?.message ?? 'Link failed');
    this.name = 'PaymentLinkError';
  }
}

/**
 * Records a payment: first the movement (expense or transfer, see
 * paymentMode), then the debt payment that points at it — createDebtPayment
 * needs an existing transaction. If linking fails (e.g. the amount is more
 * than what is owed), an expense is deleted again so the money isn't
 * counted without a payment; a transfer stays and the error says so.
 */
export async function registerDebtPayment(
  debtId: string,
  movement: PaymentMovement,
  run: GqlRunner,
): Promise<void> {
  let transactionId: string;
  if (movement.kind === 'transfer') {
    const data = await run<{ createTransfer: { fromTxnId: string } }>(
      CREATE_TRANSFER_MUTATION,
      { input: movement.input },
    );
    transactionId = data.createTransfer.fromTxnId;
  } else {
    const data = await run<{ createTransaction: { id: string } }>(
      CREATE_EXPENSE_MUTATION,
      { input: movement.input },
    );
    transactionId = data.createTransaction.id;
  }

  try {
    await run(CREATE_DEBT_PAYMENT_MUTATION, {
      input: {
        debtId,
        transactionId,
        amount: movement.input.amount,
        date: movement.input.txnDate,
      },
    });
  } catch (error) {
    let undone = false;
    if (movement.kind === 'expense') {
      try {
        await run(DELETE_TRANSACTION_MUTATION, { id: transactionId });
        undone = true;
      } catch {
        // Left in place; the message tells the user.
      }
    }
    throw new PaymentLinkError(error, undone);
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
    return t(
      error.undone
        ? 'debts.errors.paymentUndone'
        : 'debts.errors.paymentNotLinked',
      { reason: text },
    );
  }
  return text;
}
