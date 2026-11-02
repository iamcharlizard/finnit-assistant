import 'server-only';

import { notFound } from 'next/navigation';

import { serverGraphql } from '@/lib/api/server-graphql';
import { isUuid } from '@/lib/files/routes';
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
import { buildLoanDetailView, type LoanDetailView } from './detail-view';
import {
  DEBT_DETAIL_FIELDS,
  DEBT_FIELDS,
  DEBT_INSIGHTS_FIELDS,
  type ApiDebtInsights,
  LOAN_SCHEDULE_FIELDS,
  type ApiDebt,
  type ApiDebtDetail,
  type ApiLoanScheduleItem,
} from './types';
import { buildDebtsView, type DebtsView } from './view';

/** The API's page limit; far more debts than anyone has. */
const DEBTS_PAGE = 100;

const DEBTS_QUERY = `query Debts($first: Int!) {
  debts(first: $first) { edges { node { ${DEBT_FIELDS} } } }
  debtInsights { ${DEBT_INSIGHTS_FIELDS} }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key }
}`;

export interface DebtsScreenData {
  view: DebtsView;
  /** Raw figures: the charts build their view on the client (MSI toggle). */
  insights: ApiDebtInsights;
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
      debtInsights: ApiDebtInsights;
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
  return {
    view,
    insights: data.debtInsights,
    categories: data.categories,
    plan,
  };
}

const DEBT_DETAIL_QUERY = `query DebtDetail($id: String!, $debtId: ID!) {
  debt(id: $id) { ${DEBT_DETAIL_FIELDS} }
  loanSchedule(debtId: $debtId) { ${LOAN_SCHEDULE_FIELDS} }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key }
}`;

export interface LoanDetailData {
  today: string;
  view: LoanDetailView;
  accounts: ApiAccount[];
  categories: BudgetCategory[];
}

/** One debt with its schedule for /planning/debts/[id]; unknown → 404. */
export async function loadDebtDetail(id: string): Promise<LoanDetailData> {
  if (!isUuid(id)) notFound();
  const today = todayKey();
  const [data, l] = await Promise.all([
    serverGraphql<{
      debt: ApiDebtDetail;
      loanSchedule: ApiLoanScheduleItem[];
      accounts: Connection<ApiAccount>;
      categories: BudgetCategory[];
    }>(DEBT_DETAIL_QUERY, { id, debtId: id }).catch((error: unknown) => {
      if (error instanceof Error && /not found/i.test(error.message)) {
        notFound();
      }
      throw error;
    }),
    getLocalizer(),
  ]);
  return {
    today,
    view: buildLoanDetailView(
      data.debt,
      data.loanSchedule,
      { today, categories: data.categories },
      l,
    ),
    accounts: data.accounts.edges.map((e) => e.node),
    categories: data.categories,
  };
}

const LOANS_QUERY = `query Loans($first: Int!) {
  debts(first: $first, kind: loan) { edges { node { ${DEBT_FIELDS} } } }
  debtInsights(loansOnly: true) { ${DEBT_INSIGHTS_FIELDS} }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key }
}`;

export interface LoansScreenData {
  view: DebtsView;
  insights: ApiDebtInsights;
  categories: BudgetCategory[];
}

/** Loans only, with their charts (no cards, other debts or card MSI). */
export async function loadLoans(): Promise<LoansScreenData> {
  const today = todayKey();
  const [data, l] = await Promise.all([
    serverGraphql<{
      debts: Connection<ApiDebt>;
      debtInsights: ApiDebtInsights;
      accounts: Connection<ApiAccount>;
      categories: BudgetCategory[];
    }>(LOANS_QUERY, { first: DEBTS_PAGE }),
    getLocalizer(),
  ]);
  return {
    view: buildDebtsView(
      {
        debts: data.debts.edges.map((e) => e.node),
        accounts: data.accounts.edges.map((e) => e.node),
      },
      { today },
      l,
    ),
    insights: data.debtInsights,
    categories: data.categories,
  };
}
