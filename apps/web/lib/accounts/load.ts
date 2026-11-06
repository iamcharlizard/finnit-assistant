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
  buildOverviewTimeline,
  type ApiAllBalanceHistory,
  type OverviewTimeline,
} from '@finnit/core/accounts/all-balance';
import {
  buildBalanceTimeline,
  historyWindow,
  parseDayParam,
  type ApiBalanceHistory,
  type BalanceTimeline,
} from '@finnit/core/accounts/balance-history';
import {
  type ApiAccount,
  type ApiCategory,
  type ApiTransaction,
  type Connection,
} from '@finnit/core/finance/types';
import {
  ACCOUNTS_QUERY,
  ACCOUNT_DETAIL_QUERY,
  CARD_SUMMARY_QUERY,
  DAY_MOVEMENTS,
  OVERVIEW_QUERY,
  RECENT_COUNT,
} from '@finnit/core/accounts/request';
import {
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
