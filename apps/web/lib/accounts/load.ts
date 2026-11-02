import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { indexCategories } from '@/lib/finance/categories';
import {
  endOfDayIso,
  lastDayOf,
  monthOf,
  startOfDayIso,
  todayKey,
} from '@/lib/finance/dates';
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
  PENDING_CHARGE_FIELDS,
  buildAccountDetail,
  buildAccounts,
  pickAccount,
  type AccountDetail,
  type AccountSummary,
  type BankConnectionInfo,
  type CardMonthSummaryData,
  type PendingCharge,
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

const ACCOUNT_DETAIL_QUERY = `query AccountDetail($accountId: String!, $recent: Int!, $from: DateTime!, $to: DateTime!) {
  recent: transactions(first: $recent, filters: { accountId: $accountId }) { edges { node { ${TRANSACTION_FIELDS} } } }
  categories { ${CATEGORY_FIELDS} }
  upcomingPayments(from: $from, to: $to, accountId: $accountId) { ${PENDING_CHARGE_FIELDS} }
}`;

const CARD_SUMMARY_QUERY = `query CardMonth($accountId: String!, $year: Int!, $month: Int!) {
  cardMonthSummary(accountId: $accountId, year: $year, month: $month) {
    statement { statementDate paymentDueDate statementBalance minimumPayment noInterestPayment }
  }
}`;

/** Movements in the detail's list (it scrolls); the rest are in "Movimientos". */
const RECENT_COUNT = 30;

/**
 * The user's accounts, and for the selected one (?account=…) its recent
 * movements, the recurring payments still due this month and, for credit
 * cards, the month's statement.
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

  const [detail, summary] = await Promise.all([
    serverGraphql<{
      recent: Connection<ApiTransaction>;
      categories: ApiCategory[];
      upcomingPayments: PendingCharge[];
    }>(ACCOUNT_DETAIL_QUERY, {
      accountId: card.id,
      recent: RECENT_COUNT,
      from: startOfDayIso(today),
      to: endOfDayIso(lastDayOf(month)),
    }),
    card.type === 'credit'
      ? serverGraphql<{ cardMonthSummary: CardMonthSummaryData }>(
          CARD_SUMMARY_QUERY,
          { accountId: card.id, ...month },
        ).then((d) => d.cardMonthSummary)
      : Promise.resolve(null),
  ]);

  const categories = indexCategories(detail.categories);
  return {
    ...base,
    detail: buildAccountDetail(
      card,
      {
        today,
        recent: detail.recent.edges.map((e) =>
          toTransactionRow(e.node, categories, l, { withDate: true }),
        ),
        summary,
        pending: detail.upcomingPayments,
      },
      l,
    ),
  };
}
