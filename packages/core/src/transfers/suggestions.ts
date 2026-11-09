import { accountLabel } from '../finance/accounts';
import { dayKeyOf, shortDate } from '../finance/dates';
import { formatMoney } from '../finance/money';
import { direction, transactionTitle } from '../finance/transactions';
import { TRANSACTION_FIELDS, type ApiTransaction } from '../finance/types';
import type { Localizer } from '../i18n/translator';
import type { ConvertSource } from './convert';

/**
 * Bank movements that look like a transfer between the user's own
 * accounts, waiting in "Clasificar movimientos": the user says it went to
 * one of their accounts (it becomes a transfer), to someone else (a
 * description and a category) or dismisses it.
 */

export type SuggestionReason = 'pair' | 'text' | 'rule';

export interface ApiTransferSuggestion {
  id: string;
  reason: SuggestionReason;
  counterpartAccountId: string | null;
  suggestedPattern: string;
  transaction: ApiTransaction;
  counterpartTransaction: ApiTransaction | null;
}

export const TRANSFER_SUGGESTIONS_FIELDS = `transferSuggestions(first: 20) {
    totalCount
    edges { node { id reason counterpartAccountId suggestedPattern transaction { ${TRANSACTION_FIELDS} } counterpartTransaction { ${TRANSACTION_FIELDS} } } }
  }`;

export const RESOLVE_TRANSFER_SUGGESTION_MUTATION = `mutation ResolveTransferSuggestion($id: ID!, $input: ResolveTransferSuggestionInput!) { resolveTransferSuggestion(id: $id, input: $input) }`;

export type ResolveInput =
  | {
      action: 'to_account';
      accountId: string;
      counterpartTransactionId: string | null;
      remember: boolean;
      pattern?: string;
    }
  | {
      action: 'to_someone';
      description: string | null;
      categoryId: string | null;
      remember: boolean;
      pattern?: string;
    }
  | { action: 'dismiss' };

export interface TransferSuggestionView {
  id: string;
  title: string;
  /** "Mi Cuenta · 3 nov" */
  meta: string;
  /** "-$25,686.00" */
  amount: string;
  variant: 'income' | 'expense';
  /** "Parece la entrada en Nu del 4 nov" */
  hint: string;
  /** Text to remember it by, editable. */
  pattern: string;
  /** The movement, for "A mi cuenta". */
  source: ConvertSource;
  /** Where it probably went, preselected. */
  accountId: string | null;
  counterpartTransactionId: string | null;
  /** Which categories "A otra persona" offers first. */
  categoryKind: 'expense' | 'income';
}

export function toSuggestionView(
  suggestion: ApiTransferSuggestion,
  { t, locale }: Localizer,
): TransferSuggestionView {
  const tx = suggestion.transaction;
  const out = direction(tx) !== 'in';
  const day = dayKeyOf(tx.txnDate);
  const other = suggestion.counterpartTransaction;
  const amount = Math.abs(tx.amount);
  return {
    id: suggestion.id,
    title: transactionTitle(tx, t),
    meta: [tx.account ? accountLabel(tx.account) : null, shortDate(day, locale)]
      .filter(Boolean)
      .join(' · '),
    amount: formatMoney(out ? -amount : amount, tx.currency, locale, {
      sign: 'always',
    }),
    variant: out ? 'expense' : 'income',
    hint:
      other && other.account
        ? t(
            out
              ? 'transfers.suggestions.pairOut'
              : 'transfers.suggestions.pairIn',
            {
              account: accountLabel(other.account),
              date: shortDate(dayKeyOf(other.txnDate), locale),
            },
          )
        : t(`transfers.suggestions.reasons.${suggestion.reason}`),
    pattern: suggestion.suggestedPattern,
    source: {
      id: tx.id,
      type: tx.type,
      accountId: tx.accountId,
      currency: tx.currency,
      amount,
      txnDate: tx.txnDate,
    },
    accountId: suggestion.counterpartAccountId,
    counterpartTransactionId: other?.id ?? null,
    categoryKind: tx.type === 'income' ? 'income' : 'expense',
  };
}
