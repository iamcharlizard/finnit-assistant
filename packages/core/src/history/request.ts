/**
 * The history's first-page request, shared by the web (server loader) and
 * the mobile app: the query, its variables and the screen's data.
 */
import {
  CARD_PERIOD_FIELDS,
  toCardPeriodView,
  type ApiCardPeriod,
  type CardPeriodView,
} from '../accounts/card-period';
import { buildAccounts } from '../accounts/view';
import { toPageData } from '../categorize/api';
import type {
  CategorizePageData,
  CategorizeTransaction,
} from '../categorize/types';
import { indexCategories } from '../finance/categories';
import { formatMoney } from '../finance/money';
import type { EntryCategory } from '../new-entry/graphql';
import {
  TRANSFER_SUGGESTIONS_FIELDS,
  toSuggestionView,
  type ApiTransferSuggestion,
  type TransferSuggestionView,
} from '../transfers/suggestions';
import { monthLabel, shortDate, type DayKey } from '../finance/dates';
import {
  ACCOUNT_FIELDS,
  CATEGORY_FIELDS,
  type ApiAccount,
  type ApiCategory,
  type ApiTransaction,
  type Connection,
} from '../finance/types';
import type { Localizer } from '../i18n/translator';
import {
  HISTORY_PAGE_SIZE,
  shownMonth,
  toApiFilters,
  type HistoryFilters,
} from './filters';
import { accountCardHref } from './account-card';
import {
  HISTORY_QUERY_FIELDS,
  accountOptions,
  categoryOptions,
  toTransactionPage,
  topCategoryChart,
  topCategoryRows,
  type CategoryChart,
  type Option,
  type SpendingReport,
  type TransactionPage,
} from './view';

export interface HistoryData {
  today: DayKey;
  page: TransactionPage;
  categories: ApiCategory[];
  accounts: Option[];
  /** The open credit cards ("Registrar como pago a tarjeta" in a row's menu). */
  creditCardIds: string[];
  categoryOptions: Option[];
  topCategories: {
    title: string;
    rows: ReturnType<typeof topCategoryRows>;
    chart: CategoryChart;
  };
  /** Name of the automatic name the list is filtered by. */
  aliasName: string | null;
  /** Categories the user can pick (hidden ones left out): "Mover a…". */
  pickable: EntryCategory[];
  /** Bank movements that look like transfers between own accounts. */
  transferSuggestions: { rows: TransferSuggestionView[]; total: number };
  /** How many "Por clasificar" has with the other filters (the chip's number). */
  reviewCount: number;
  /** "Por clasificar": the first page for the selectable list. */
  reviewPage: CategorizePageData | null;
  /** The one account the list is filtered by: its balance (and card cycle). */
  account: HistoryAccountCard | null;
}

/** The balance card of the one account the history is filtered by. */
export interface HistoryAccountCard {
  id: string;
  label: string;
  credit: boolean;
  /** Debit: money in it ("-" when overdrawn). Credit: what is owed. */
  balance: string;
  /** Debit below zero, or a card in favor. */
  negative: boolean;
  inFavor: boolean;
  limit: string | null;
  available: string | null;
  usedPercent: number | null;
  /** The cycle whose payment is due now. */
  period: CardPeriodView | null;
  /** A card without cut-off and payment days (its cycles need them). */
  needsTerms: boolean;
  href: string;
}

/** The spending by category of the filtered movements (the top and its chart). */
export const SPENDING_FIELDS =
  'transactionSpending(filters: $filters) { totalExpenses categoryBreakdown { categoryId categoryName amount } }';

export const HISTORY_QUERY = `query History($first: Int!, $after: String, $filters: TransactionFilters, $reviewFilters: TransactionFilters, $cardId: ID!, $oneAccount: Boolean!) {
  ${HISTORY_QUERY_FIELDS}
  review: transactions(first: 1, filters: $reviewFilters) { totalCount }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
  categories(includeHidden: true) { ${CATEGORY_FIELDS} }
  ${SPENDING_FIELDS}
  merchantAliases { id displayName }
  pickable: categories { id name parentId key kind icon }
  ${TRANSFER_SUGGESTIONS_FIELDS}
  creditCardPeriod(accountId: $cardId) @include(if: $oneAccount) { ${CARD_PERIOD_FIELDS} }
}`;

export interface HistoryResult {
  transactions: Connection<CategorizeTransaction>;
  review: { totalCount: number };
  creditCardPeriod?: ApiCardPeriod | null;
  pickable: EntryCategory[];
  transferSuggestions: Connection<ApiTransferSuggestion>;
  accounts: Connection<ApiAccount>;
  categories: ApiCategory[];
  transactionSpending: SpendingReport;
  merchantAliases: { id: string; displayName: string }[];
}

/** The period the top covers: the month, the range or the whole history. */
export function spendingPeriodLabel(
  filters: HistoryFilters,
  { locale, t }: Localizer,
): string {
  const month = shownMonth(filters);
  if (month) return monthLabel(month, locale);
  if (filters.from || filters.to) {
    return t('history.rangeLabel', {
      from: filters.from ? shortDate(filters.from, locale) : '…',
      to: filters.to ? shortDate(filters.to, locale) : '…',
    });
  }
  return t('history.allTime');
}

/** The one account the list is filtered by, if any. */
export function oneAccountOf(filters: HistoryFilters): string | null {
  return filters.accountIds?.length === 1 ? filters.accountIds[0]! : null;
}

/** `shown`: how many rows were loaded (`?n=`), brought back on a reload. */
export function historyVariables(
  filters: HistoryFilters,
  shown: number = HISTORY_PAGE_SIZE,
) {
  const account = oneAccountOf(filters);
  return {
    first: shown,
    after: null,
    filters: toApiFilters(filters),
    // The chip counts what "Por clasificar" would show with the rest.
    reviewFilters: toApiFilters({ ...filters, review: true }),
    cardId: account ?? '',
    oneAccount: account !== null,
  };
}

function accountCard(
  data: HistoryResult,
  filters: HistoryFilters,
  today: DayKey,
  l: Localizer,
): HistoryAccountCard | null {
  const id = oneAccountOf(filters);
  const api = id ? data.accounts.edges.find((e) => e.node.id === id) : null;
  if (!api) return null;
  const [summary] = buildAccounts([api.node], [], l, { showArchived: true });
  if (!summary) return null;
  const credit = summary.credit;
  const limit = credit?.limit ?? null;
  const period = data.creditCardPeriod ?? null;
  return {
    id: summary.id,
    label: summary.label,
    credit: credit !== null,
    balance:
      credit && credit.owed === 0 && api.node.balanceCurrent > 0
        ? formatMoney(api.node.balanceCurrent, summary.currency, l.locale)
        : summary.balance,
    negative: credit === null && summary.amount < 0,
    inFavor: credit !== null && api.node.balanceCurrent > 0,
    limit:
      limit !== null ? formatMoney(limit, summary.currency, l.locale) : null,
    available: credit?.available ?? null,
    usedPercent:
      limit !== null && credit
        ? Math.min(100, Math.max(0, Math.round((credit.owed / limit) * 100)))
        : null,
    period: period ? toCardPeriodView(period, today, l) : null,
    needsTerms: credit !== null && summary.statementDay === null,
    href: accountCardHref(summary.id),
  };
}

/** First page of the filtered history plus what the filters and aside need. */
export function buildHistoryData(
  data: HistoryResult,
  filters: HistoryFilters,
  today: DayKey,
  l: Localizer,
): HistoryData {
  const { t } = l;
  const chart = topCategoryChart(data.transactionSpending, data.categories, l);
  return {
    today,
    page: toTransactionPage(
      data.transactions,
      indexCategories(data.categories),
      l,
    ),
    categories: data.categories,
    accounts: accountOptions(
      data.accounts.edges.map((e) => e.node),
      t,
    ),
    creditCardIds: data.accounts.edges
      .map((e) => e.node)
      .filter((a) => a.type === 'credit' && !a.archived)
      .map((a) => a.id),
    categoryOptions: categoryOptions(data.categories, t),
    topCategories: {
      title: t('history.topCategories', {
        month: spendingPeriodLabel(filters, l),
      }),
      rows: topCategoryRows(chart),
      chart,
    },
    aliasName: filters.aliasId
      ? (data.merchantAliases.find((a) => a.id === filters.aliasId)
          ?.displayName ?? null)
      : null,
    pickable: data.pickable,
    transferSuggestions: {
      rows: data.transferSuggestions.edges.map((e) =>
        toSuggestionView(e.node, l),
      ),
      total: data.transferSuggestions.totalCount,
    },
    reviewCount: data.review.totalCount,
    reviewPage: filters.review ? toPageData(data.transactions) : null,
    account: accountCard(data, filters, today, l),
  };
}
