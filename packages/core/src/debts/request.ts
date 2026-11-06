/** The debts screens' requests, shared by the web loader and the mobile app. */
import { ACCOUNT_FIELDS, type ApiAccount, type Connection } from '../finance/types';
import type { BudgetCategory } from '../budgets/types';
import {
  DEBT_DETAIL_FIELDS,
  DEBT_FIELDS,
  DEBT_INSIGHTS_FIELDS,
  LOAN_SCHEDULE_FIELDS,
  type ApiDebt,
  type ApiDebtDetail,
  type ApiDebtInsights,
  type ApiLoanScheduleItem,
} from './types';

/** The API's page limit; far more debts than anyone has. */
export const DEBTS_PAGE = 100;

export const DEBTS_QUERY = `query Debts($first: Int!) {
  debts(first: $first) { edges { node { ${DEBT_FIELDS} } } }
  debtInsights { ${DEBT_INSIGHTS_FIELDS} }
  loanInsights: debtInsights(loansOnly: true) { ${DEBT_INSIGHTS_FIELDS} }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key kind icon }
}`;

export interface DebtsResult {
  debts: Connection<ApiDebt>;
  debtInsights: ApiDebtInsights;
  loanInsights: ApiDebtInsights;
  accounts: Connection<ApiAccount>;
  categories: BudgetCategory[];
}

export const DEBT_DETAIL_QUERY = `query DebtDetail($id: String!, $debtId: ID!) {
  debt(id: $id) { ${DEBT_DETAIL_FIELDS} }
  loanSchedule(debtId: $debtId) { ${LOAN_SCHEDULE_FIELDS} }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories { id name parentId key kind icon }
}`;

export interface DebtDetailResult {
  debt: ApiDebtDetail;
  loanSchedule: ApiLoanScheduleItem[];
  accounts: Connection<ApiAccount>;
  categories: BudgetCategory[];
}
