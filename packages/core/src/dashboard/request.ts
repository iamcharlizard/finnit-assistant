/**
 * The dashboard's requests, shared by the web (server loader) and the
 * mobile app (urql): the query, its variables and the data the view
 * builder takes.
 */
import { BUDGET_FIELDS, type ApiBudget } from '../budgets/types';
import { DEBT_INSIGHTS_FIELDS, type ApiDebtInsights } from '../debts/types';
import {
  addDays,
  endOfDayIso,
  firstDayOf,
  monthOf,
  shiftMonth,
  startOfDayIso,
  type DayKey,
} from '../finance/dates';
import {
  ACCOUNT_FIELDS,
  MONTHLY_REPORT_FIELDS,
  UPCOMING_PAYMENT_FIELDS,
  type ApiAccount,
  type ApiMonthlyReport,
  type ApiUpcomingPayment,
  type Connection,
} from '../finance/types';
import {
  DASHBOARD_CONNECTION_FIELDS,
  MONTH_COMPARISON_FIELDS,
  UPCOMING_DAYS,
  type ApiDailyCashFlow,
  type ApiDashboardConnection,
  type ApiMonthComparison,
  type DashboardData,
} from './view';

export const DASHBOARD_QUERY = `query Dashboard($year: Int!, $month: Int!, $from: DateTime!, $to: DateTime!, $flowFrom: String!, $flowTo: String!) {
  accounts(first: 100, archived: false) { edges { node { ${ACCOUNT_FIELDS} } } }
  monthlyReport(year: $year, month: $month) { ${MONTHLY_REPORT_FIELDS} }
  upcomingPayments(from: $from, to: $to) { ${UPCOMING_PAYMENT_FIELDS} }
  transactions(first: 1) { totalCount }
  debtInsights { ${DEBT_INSIGHTS_FIELDS} }
  dailyCashFlow(from: $flowFrom, to: $flowTo) { date income expenses }
  monthToDateComparison(today: $flowTo) { ${MONTH_COMPARISON_FIELDS} }
  bankConnections { ${DASHBOARD_CONNECTION_FIELDS} }
}`;

export interface DashboardResult {
  accounts: Connection<ApiAccount>;
  monthlyReport: ApiMonthlyReport;
  upcomingPayments: ApiUpcomingPayment[];
  transactions: { totalCount: number };
  debtInsights: ApiDebtInsights;
  dailyCashFlow: ApiDailyCashFlow[];
  monthToDateComparison: ApiMonthComparison | null;
  bankConnections: ApiDashboardConnection[];
}

export function dashboardVariables(today: DayKey) {
  return {
    ...monthOf(today),
    from: startOfDayIso(today),
    to: endOfDayIso(addDays(today, UPCOMING_DAYS)),
    flowFrom: firstDayOf(shiftMonth(monthOf(today), -1)),
    flowTo: today,
  };
}

export function dashboardData(result: DashboardResult): DashboardData {
  return {
    accounts: result.accounts.edges.map((e) => e.node),
    monthlyReport: result.monthlyReport,
    upcomingPayments: result.upcomingPayments,
    transactionCount: result.transactions.totalCount,
    debtInsights: result.debtInsights,
    cashFlow: result.dailyCashFlow,
    comparison: result.monthToDateComparison,
    bankConnections: result.bankConnections,
  };
}

/** The current month's budget card: budgets and the month's spending. */
export const DASHBOARD_BUDGET_QUERY = `query DashboardBudget($year: Int!, $month: Int!) {
  budgets { ${BUDGET_FIELDS} }
  monthlyReport(year: $year, month: $month) { totalExpenses }
}`;

export interface DashboardBudgetResult {
  budgets: ApiBudget[];
  monthlyReport: Pick<ApiMonthlyReport, 'totalExpenses'>;
}
