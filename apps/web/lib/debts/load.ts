import 'server-only';

import { notFound } from 'next/navigation';

import { serverGraphql } from '@/lib/api/server-graphql';
import { isUuid } from '@/lib/files/routes';
import { getLocalizer } from '@/lib/i18n/server';
import { todayKey } from '@finnit/core/finance/dates';
import {
  ACCOUNT_FIELDS,
  type ApiAccount,
  type Connection,
} from '@finnit/core/finance/types';
import type { BudgetCategory } from '@finnit/core/budgets/types';
import { loadPayoffComparison } from '@finnit/core/debts/api';
import { buildPayoffComparison, type PayoffComparison } from '@finnit/core/debts/payoff';
import { buildLoanDetailView, type LoanDetailView } from '@finnit/core/debts/detail-view';
import {
  DEBT_DETAIL_FIELDS,
  DEBT_FIELDS,
  DEBT_INSIGHTS_FIELDS,
  type ApiDebtInsights,
  LOAN_SCHEDULE_FIELDS,
  type ApiDebt,
  type ApiDebtDetail,
  type ApiLoanScheduleItem,
} from '@finnit/core/debts/types';
import { buildDebtsView, type DebtsView } from '@finnit/core/debts/view';

/** The API's page limit; far more debts than anyone has. */
const DEBTS_PAGE = 100;

const DEBTS_QUERY = `query Debts($first: Int!) {
  debts(first: $first) { edges { node { ${DEBT_FIELDS} } } }
  debtInsights { ${DEBT_INSIGHTS_FIELDS} }
  loanInsights: debtInsights(loansOnly: true) { ${DEBT_INSIGHTS_FIELDS} }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key kind icon }
}`;

/** Tabs of Deudas; the URL's ?tab= picks one. */
export const DEBT_TABS = ['summary', 'loans', 'other'] as const;
export type DebtTab = (typeof DEBT_TABS)[number];

export function parseDebtTab(value: unknown): DebtTab {
  return DEBT_TABS.find((tab) => tab === value) ?? 'summary';
}

export interface DebtsScreenData {
  view: DebtsView;
  /** Loans only (the Préstamos tab's totals). */
  loansView: DebtsView;
  /** Raw figures: the charts build their view on the client (MSI toggle). */
  insights: ApiDebtInsights;
  /** The loans' charts (no cards, other debts or card MSI). */
  loanInsights: ApiDebtInsights;
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
      loanInsights: ApiDebtInsights;
      accounts: Connection<ApiAccount>;
      categories: BudgetCategory[];
    }>(DEBTS_QUERY, { first: DEBTS_PAGE }),
    getLocalizer(),
  ]);
  const debts = data.debts.edges.map((e) => e.node);
  const accounts = data.accounts.edges.map((e) => e.node);
  const view = buildDebtsView({ debts, accounts }, { today }, l);
  const loansView = buildDebtsView(
    { debts: debts.filter((d) => d.kind === 'loan'), accounts },
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
    loansView,
    insights: data.debtInsights,
    loanInsights: data.loanInsights,
    categories: data.categories,
    plan,
  };
}

const DEBT_DETAIL_QUERY = `query DebtDetail($id: String!, $debtId: ID!) {
  debt(id: $id) { ${DEBT_DETAIL_FIELDS} }
  loanSchedule(debtId: $debtId) { ${LOAN_SCHEDULE_FIELDS} }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key kind icon }
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
