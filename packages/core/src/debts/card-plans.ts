/**
 * A credit card's "Pagos a meses" tab: its purchases in installments, as
 * the debts screen lists them. Loaded on the client when the tab opens.
 */
import {
  ACCOUNT_FIELDS,
  type ApiAccount,
  type Connection,
} from '../finance/types';
import type { BudgetCategory } from '../budgets/types';
import { DEBTS_PAGE } from './request';
import { DEBT_FIELDS, isCardInstallments, type ApiDebt } from './types';

export const CARD_PLANS_QUERY = `query CardPlans($first: Int!) {
  debts(first: $first) { edges { node { ${DEBT_FIELDS} } } }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key kind icon }
}`;

export const cardPlansVariables = () => ({ first: DEBTS_PAGE });

export interface CardPlansResult {
  debts: Connection<ApiDebt>;
  accounts: Connection<ApiAccount>;
  categories: BudgetCategory[];
}

/** The card's purchases in installments: running first, then paid off. */
export function cardPlansOf(
  debts: ReadonlyArray<ApiDebt>,
  accountId: string,
): ApiDebt[] {
  return debts
    .filter((d) => d.linkedAccountId === accountId && isCardInstallments(d))
    .sort(
      (a, b) =>
        Number(a.status === 'paid_off') - Number(b.status === 'paid_off') ||
        (b.startDate ?? '').localeCompare(a.startDate ?? ''),
    );
}
