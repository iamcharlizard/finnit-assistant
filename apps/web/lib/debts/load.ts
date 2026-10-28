import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { todayKey } from '@/lib/finance/dates';
import {
  ACCOUNT_FIELDS,
  type ApiAccount,
  type Connection,
} from '@/lib/finance/types';
import type { BudgetCategory } from '@/lib/budgets/types';
import { loadPayoffComparison } from './api';
import { buildPayoffComparison, type PayoffComparison } from './payoff';
import { DEBT_FIELDS, type ApiDebt } from './types';
import { buildDebtsView, type DebtsView } from './view';

/** The API's page limit; far more debts than anyone has. */
const DEBTS_PAGE = 100;

const DEBTS_QUERY = `query Debts($first: Int!) {
  debts(first: $first) { edges { node { ${DEBT_FIELDS} } } }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key }
}`;

export interface DebtsScreenData {
  view: DebtsView;
  categories: BudgetCategory[];
  /** The plan with no extra payment; null without debts to pay. */
  plan: PayoffComparison | null;
}

/**
 * Debts, accounts (linked accounts and payment sources, archived ones
 * included so a linked account still shows its name) and categories; then
 * the payoff plan of the debts still owed with no extra payment, so the
 * comparison shows on first paint.
 */
export async function loadDebts(): Promise<DebtsScreenData> {
  const today = todayKey();
  const [data, l] = await Promise.all([
    serverGraphql<{
      debts: Connection<ApiDebt>;
      accounts: Connection<ApiAccount>;
      categories: BudgetCategory[];
    }>(DEBTS_QUERY, { first: DEBTS_PAGE }),
    getLocalizer(),
  ]);
  const view = buildDebtsView(
    {
      debts: data.debts.edges.map((e) => e.node),
      accounts: data.accounts.edges.map((e) => e.node),
    },
    { today },
    l,
  );
  const plan =
    view.activeIds.length > 0
      ? buildPayoffComparison(
          await loadPayoffComparison(view.activeIds, 0, serverGraphql),
          { today },
          l,
        )
      : null;
  return { view, categories: data.categories, plan };
}
