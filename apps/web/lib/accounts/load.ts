import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { getLocalizer } from '@/lib/i18n/server';
import { indexCategories } from '@finnit/core/finance/categories';
import {
  endOfDayIso,
  lastDayOf,
  monthOf,
  startOfDayIso,
  todayKey,
  type DayKey,
} from '@finnit/core/finance/dates';
import {
  toTransactionRow,
  type TransactionRow,
} from '@finnit/core/finance/transactions';
import type { Localizer } from '@finnit/core/i18n/translator';
import {
  ALL_BALANCE_FIELDS,
  buildOverviewTimeline,
  type ApiAllBalanceHistory,
  type OverviewTimeline,
} from '@finnit/core/accounts/all-balance';
import {
  BALANCE_HISTORY_FIELDS,
  buildBalanceTimeline,
  historyWindow,
  parseDayParam,
  type ApiBalanceHistory,
  type BalanceTimeline,
} from '@finnit/core/accounts/balance-history';
import {
  ACCOUNT_FIELDS,
  CATEGORY_FIELDS,
  TRANSACTION_FIELDS,
  type ApiAccount,
  type ApiCategory,
  type ApiTransaction,
  type Connection,
} from '@finnit/core/finance/types';
import {
  BANK_CONNECTIONS_FIELDS,
  PENDING_CHARGE_FIELDS,
  buildAccountDetail,
  buildAccounts,
  type AccountDetail,
  type AccountSummary,
  type BankConnectionInfo,
  type CardMonthSummaryData,
  type PendingCharge,
} from '@finnit/core/accounts/view';

/** All the accounts together (no account chosen). */
export interface OverviewData {
  timeline: OverviewTimeline | null;
  /** Latest movements of every account, or the chosen day's. */
  recent: TransactionRow[];
  historyHref: string;
}

export interface AccountsData {
  accounts: AccountSummary[];
  detail: AccountDetail | null;
  /** Shown when no account is chosen (and there is any). */
  overview: OverviewData | null;
  /** The selected account's balance on the chosen day and around it. */
  timeline: BalanceTimeline | null;
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

const ACCOUNT_DETAIL_QUERY = `query AccountDetail($accountId: String!, $recent: Int!, $from: DateTime!, $to: DateTime!, $dayStart: DateTime, $dayEnd: DateTime, $historyFrom: DateTime!, $historyTo: DateTime!) {
  recent: transactions(first: $recent, filters: { accountId: $accountId, startDate: $dayStart, endDate: $dayEnd }) { edges { node { ${TRANSACTION_FIELDS} } } }
  categories(includeHidden: true) { ${CATEGORY_FIELDS} }
  upcomingPayments(from: $from, to: $to, accountId: $accountId) { ${PENDING_CHARGE_FIELDS} }
  accountBalanceHistory(accountId: $accountId, from: $historyFrom, to: $historyTo) { ${BALANCE_HISTORY_FIELDS} }
}`;

const OVERVIEW_QUERY = `query AccountsOverview($recent: Int!, $dayStart: DateTime, $dayEnd: DateTime, $historyFrom: DateTime!, $historyTo: DateTime!) {
  recent: transactions(first: $recent, filters: { startDate: $dayStart, endDate: $dayEnd }) { edges { node { ${TRANSACTION_FIELDS} } } }
  categories(includeHidden: true) { ${CATEGORY_FIELDS} }
  accountsBalanceHistory(from: $historyFrom, to: $historyTo) { ${ALL_BALANCE_FIELDS} }
}`;

const CARD_SUMMARY_QUERY = `query CardMonth($accountId: String!, $year: Int!, $month: Int!) {
  cardMonthSummary(accountId: $accountId, year: $year, month: $month) {
    statement { statementDate paymentDueDate statementBalance minimumPayment noInterestPayment }
  }
}`;

/** Movements in the detail's list (it scrolls); the rest are in "Movimientos". */
const RECENT_COUNT = 30;
/** A past day's movements (all of them, in practice). */
const DAY_MOVEMENTS = 100;

/**
 * The user's accounts, and for the selected one (?account=…) its recent
 * movements, the recurring payments still due this month, its balance day
 * by day and, for credit cards, the month's statement. Without one, every
 * account together (`overview`). With a past `day` (?day=YYYY-MM-DD) the
 * movements are that day's.
 */
export async function loadAccounts({
  requested,
  showArchived = false,
  day: requestedDay,
}: {
  requested?: string | string[];
  showArchived?: boolean;
  day?: string | string[];
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
  const today = todayKey();
  const day = parseDayParam(requestedDay, today);
  const window = historyWindow(day, today);

  const id = Array.isArray(requested) ? requested[0] : requested;
  const card = id ? (accounts.find((a) => a.id === id) ?? null) : null;
  if (!card) {
    const overview =
      accounts.length > 0
        ? await loadOverview({ day, today, window, accounts }, l)
        : null;
    return { ...base, detail: null, timeline: null, overview };
  }
  const month = monthOf(today);

  const [detail, summary] = await Promise.all([
    serverGraphql<{
      recent: Connection<ApiTransaction>;
      categories: ApiCategory[];
      upcomingPayments: PendingCharge[];
      accountBalanceHistory: ApiBalanceHistory;
    }>(ACCOUNT_DETAIL_QUERY, {
      accountId: card.id,
      recent: day ? DAY_MOVEMENTS : RECENT_COUNT,
      from: startOfDayIso(today),
      to: endOfDayIso(lastDayOf(month)),
      dayStart: day ? startOfDayIso(day) : null,
      dayEnd: day ? endOfDayIso(day) : null,
      historyFrom: startOfDayIso(window.from),
      historyTo: startOfDayIso(window.to),
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
    overview: null,
    timeline: buildBalanceTimeline(
      detail.accountBalanceHistory,
      { day, today, isCredit: card.type === 'credit' },
      l,
    ),
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

async function loadOverview(
  {
    day,
    today,
    window,
    accounts,
  }: {
    day: DayKey | null;
    today: DayKey;
    window: { from: DayKey; to: DayKey };
    accounts: ReadonlyArray<AccountSummary>;
  },
  l: Localizer,
): Promise<OverviewData> {
  const data = await serverGraphql<{
    recent: Connection<ApiTransaction>;
    categories: ApiCategory[];
    accountsBalanceHistory: ApiAllBalanceHistory;
  }>(OVERVIEW_QUERY, {
    recent: day ? DAY_MOVEMENTS : RECENT_COUNT,
    dayStart: day ? startOfDayIso(day) : null,
    dayEnd: day ? endOfDayIso(day) : null,
    historyFrom: startOfDayIso(window.from),
    historyTo: startOfDayIso(window.to),
  });
  const categories = indexCategories(data.categories);
  const currency = data.accountsBalanceHistory.currency;
  return {
    timeline: buildOverviewTimeline(
      data.accountsBalanceHistory,
      {
        day,
        today,
        hasCards: accounts.some(
          (a) => a.type === 'credit' && !a.archived && a.currency === currency,
        ),
      },
      l,
    ),
    recent: data.recent.edges.map((e) =>
      toTransactionRow(e.node, categories, l, { withDate: true }),
    ),
    historyHref: day ? `/history?from=${day}&to=${day}` : '/history',
  };
}
