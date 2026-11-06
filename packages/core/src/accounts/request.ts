/**
 * The accounts screen's requests, shared by the web loader and the mobile
 * app.
 */
import { ALL_BALANCE_FIELDS, type ApiAllBalanceHistory } from './all-balance';
import { BALANCE_HISTORY_FIELDS, type ApiBalanceHistory } from './balance-history';
import {
  ACCOUNT_FIELDS,
  CATEGORY_FIELDS,
  TRANSACTION_FIELDS,
  type ApiAccount,
  type ApiCategory,
  type ApiTransaction,
  type Connection,
} from '../finance/types';
import {
  BANK_CONNECTIONS_FIELDS,
  PENDING_CHARGE_FIELDS,
  type BankConnectionInfo,
  type CardMonthSummaryData,
  type PendingCharge,
} from './view';

// Archived accounts too: the toggle shows them and their names stay taken.
export const ACCOUNTS_QUERY = `query Accounts {
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  bankConnections { ${BANK_CONNECTIONS_FIELDS} }
}`;

export const ACCOUNT_DETAIL_QUERY = `query AccountDetail($accountId: String!, $recent: Int!, $from: DateTime!, $to: DateTime!, $dayStart: DateTime, $dayEnd: DateTime, $historyFrom: DateTime!, $historyTo: DateTime!) {
  recent: transactions(first: $recent, filters: { accountId: $accountId, startDate: $dayStart, endDate: $dayEnd }) { edges { node { ${TRANSACTION_FIELDS} } } }
  categories(includeHidden: true) { ${CATEGORY_FIELDS} }
  upcomingPayments(from: $from, to: $to, accountId: $accountId) { ${PENDING_CHARGE_FIELDS} }
  accountBalanceHistory(accountId: $accountId, from: $historyFrom, to: $historyTo) { ${BALANCE_HISTORY_FIELDS} }
}`;

export const OVERVIEW_QUERY = `query AccountsOverview($recent: Int!, $dayStart: DateTime, $dayEnd: DateTime, $historyFrom: DateTime!, $historyTo: DateTime!) {
  recent: transactions(first: $recent, filters: { startDate: $dayStart, endDate: $dayEnd }) { edges { node { ${TRANSACTION_FIELDS} } } }
  categories(includeHidden: true) { ${CATEGORY_FIELDS} }
  accountsBalanceHistory(from: $historyFrom, to: $historyTo) { ${ALL_BALANCE_FIELDS} }
}`;

export const CARD_SUMMARY_QUERY = `query CardMonth($accountId: String!, $year: Int!, $month: Int!) {
  cardMonthSummary(accountId: $accountId, year: $year, month: $month) {
    statement { statementDate paymentDueDate statementBalance minimumPayment noInterestPayment }
  }
}`;

/** Movements in the detail's list (it scrolls); the rest are in "Movimientos". */
export const RECENT_COUNT = 30;
/** A past day's movements (all of them, in practice). */
export const DAY_MOVEMENTS = 100;

export interface AccountsResult {
  accounts: Connection<ApiAccount>;
  bankConnections: BankConnectionInfo[];
}

export interface AccountDetailResult {
  recent: Connection<ApiTransaction>;
  categories: ApiCategory[];
  upcomingPayments: PendingCharge[];
  accountBalanceHistory: ApiBalanceHistory;
}

export interface OverviewResult {
  recent: Connection<ApiTransaction>;
  categories: ApiCategory[];
  accountsBalanceHistory: ApiAllBalanceHistory;
}

export interface CardMonthResult {
  cardMonthSummary: CardMonthSummaryData;
}
