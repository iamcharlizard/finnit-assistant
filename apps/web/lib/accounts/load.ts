import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { indexCategories } from '@/lib/finance/categories';
import {
  endOfDayIso,
  firstDayOf,
  lastDayOf,
  monthLabel,
  monthOf,
  startOfDayIso,
  todayKey,
} from '@/lib/finance/dates';
import { roundCents } from '@/lib/finance/money';
import { toTransactionRow } from '@/lib/finance/transactions';
import {
  ACCOUNT_FIELDS,
  CATEGORY_FIELDS,
  TRANSACTION_FIELDS,
  type ApiAccount,
  type ApiCategory,
  type ApiTransaction,
  type Connection,
} from '@/lib/finance/types';
import {
  BANK_CONNECTIONS_FIELDS,
  buildAccountDetail,
  buildAccounts,
  pickAccount,
  type AccountDetail,
  type AccountSummary,
  type BankConnectionInfo,
  type CardMonthSummaryData,
} from './view';

export interface AccountsData {
  accounts: AccountSummary[];
  detail: AccountDetail | null;
  showArchived: boolean;
  archivedCount: number;
  /** Every account name the user has (archived too): names are unique. */
  existingNames: string[];
}

// Archived accounts too: the toggle shows them and their names stay taken.
const ACCOUNTS_QUERY = `query Accounts {
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  bankConnections { ${BANK_CONNECTIONS_FIELDS} }
}`;

const CARD_DETAIL_QUERY = `query CardDetail($accountId: String!, $month: TransactionFilters!, $recent: Int!) {
  recent: transactions(first: $recent, filters: { accountId: $accountId }) { edges { node { ${TRANSACTION_FIELDS} } } }
  categories { ${CATEGORY_FIELDS} }
  monthExpenses: transactions(first: 100, filters: $month) { edges { node { amount } } pageInfo { endCursor hasNextPage } }
}`;

const CARD_SUMMARY_QUERY = `query CardMonth($accountId: String!, $year: Int!, $month: Int!) {
  cardMonthSummary(accountId: $accountId, year: $year, month: $month) {
    recurringExpected recurringPaid recurringPayments { name }
    statement { statementDate paymentDueDate statementBalance minimumPayment noInterestPayment }
  }
}`;

const MONTH_EXPENSES_PAGE = `query CardMonthExpenses($month: TransactionFilters!, $after: String) {
  transactions(first: 100, after: $after, filters: $month) { edges { node { amount } } pageInfo { endCursor hasNextPage } }
}`;

/** At most this many extra pages (100 each) when adding up a month. */
const MAX_EXTRA_PAGES = 9;

type AmountsPage = Connection<Pick<ApiTransaction, 'amount'>>;

/**
 * The user's accounts, and for the selected one (?account=…) its recent
 * movements, this month's spending and, for credit cards, the month summary.
 */
export async function loadAccounts({
  requested,
  showArchived = false,
}: {
  requested?: string | string[];
  showArchived?: boolean;
} = {}): Promise<AccountsData> {
  const [{ accounts: connection, bankConnections }, l] = await Promise.all([
    serverGraphql<{
      accounts: Connection<ApiAccount>;
      bankConnections: BankConnectionInfo[];
    }>(ACCOUNTS_QUERY),
    getLocalizer(),
  ]);

  const all = connection.edges.map((e) => e.node);
  const accounts = buildAccounts(all, bankConnections, l, { showArchived });
  const base = {
    accounts,
    showArchived,
    archivedCount: all.filter((a) => a.archived).length,
    existingNames: all.map((a) => a.name),
  };
  const card = pickAccount(accounts, requested);
  if (!card) return { ...base, detail: null };

  const today = todayKey();
  const month = monthOf(today);
  const monthFilter = {
    accountId: card.id,
    type: 'expense',
    startDate: startOfDayIso(firstDayOf(month)),
    endDate: endOfDayIso(lastDayOf(month)),
  };

  const [detail, summary] = await Promise.all([
    serverGraphql<{
      recent: Connection<ApiTransaction>;
      categories: ApiCategory[];
      monthExpenses: AmountsPage;
    }>(CARD_DETAIL_QUERY, {
      accountId: card.id,
      month: monthFilter,
      recent: 8,
    }),
    card.type === 'credit'
      ? serverGraphql<{ cardMonthSummary: CardMonthSummaryData }>(
          CARD_SUMMARY_QUERY,
          { accountId: card.id, ...month },
        ).then((d) => d.cardMonthSummary)
      : Promise.resolve(null),
  ]);

  // A month rarely has more than 100 charges on one card; add up the rest.
  let spending = sumAmounts(detail.monthExpenses);
  let page = detail.monthExpenses.pageInfo;
  for (let i = 0; page.hasNextPage && i < MAX_EXTRA_PAGES; i++) {
    const next = await serverGraphql<{ transactions: AmountsPage }>(
      MONTH_EXPENSES_PAGE,
      { month: monthFilter, after: page.endCursor },
    );
    spending = roundCents(spending + sumAmounts(next.transactions));
    page = next.transactions.pageInfo;
  }

  const categories = indexCategories(detail.categories);
  return {
    ...base,
    detail: buildAccountDetail(
      card,
      {
        today,
        monthLabel: monthLabel(month, l.locale),
        monthSpending: spending,
        recent: detail.recent.edges.map((e) =>
          toTransactionRow(e.node, categories, l, { withDate: true }),
        ),
        summary,
      },
      l,
    ),
  };
}

function sumAmounts(page: AmountsPage): number {
  return roundCents(page.edges.reduce((sum, e) => sum + e.node.amount, 0));
}
