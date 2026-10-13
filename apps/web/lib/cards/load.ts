import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
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
  buildCardDetail,
  buildCards,
  pickCard,
  type BankConnectionInfo,
  type CardDetail,
  type CardMonthSummaryData,
  type CardSummary,
} from './view';

export interface CardsData {
  cards: CardSummary[];
  detail: CardDetail | null;
}

const CARDS_QUERY = `query Cards {
  accounts(first: 100, archived: false) { edges { node { ${ACCOUNT_FIELDS} } } }
  bankConnections { institution accounts { accountId mask creditLimit availableCredit } }
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
 * The user's cards, and for the selected one (?card=…) its recent
 * movements, this month's spending and, for credit cards, the month summary.
 */
export async function loadCards(
  requested?: string | string[],
): Promise<CardsData> {
  const { accounts, bankConnections } = await serverGraphql<{
    accounts: Connection<ApiAccount>;
    bankConnections: BankConnectionInfo[];
  }>(CARDS_QUERY);

  const cards = buildCards(
    accounts.edges.map((e) => e.node),
    bankConnections,
  );
  const card = pickCard(cards, requested);
  if (!card) return { cards, detail: null };

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
    card.kind === 'credit'
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
    cards,
    detail: buildCardDetail(card, {
      today,
      monthLabel: monthLabel(month),
      monthSpending: spending,
      recent: detail.recent.edges.map((e) =>
        toTransactionRow(e.node, categories, { withDate: true }),
      ),
      summary,
    }),
  };
}

function sumAmounts(page: AmountsPage): number {
  return roundCents(page.edges.reduce((sum, e) => sum + e.node.amount, 0));
}
