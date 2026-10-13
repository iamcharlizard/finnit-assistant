import type { CardVariant } from '@finnit/ui/components/finance/bank-payment-card';

import type { Localizer } from '@/lib/i18n/translator';
import { creditOwed, nextMonthlyDay } from '@/lib/finance/accounts';
import {
  dayKeyOf,
  relativeDayLabel,
  shortDate,
  type DayKey,
} from '@/lib/finance/dates';
import { formatMoney, roundCents } from '@/lib/finance/money';
import type { TransactionRow } from '@/lib/finance/transactions';
import type { ApiAccount } from '@/lib/finance/types';

/** A linked bank account as bankConnections returns it. */
export interface LinkedAccountInfo {
  accountId: string | null;
  mask: string | null;
  creditLimit: number | null;
  availableCredit: number | null;
}

export interface BankConnectionInfo {
  institution: string | null;
  accounts: LinkedAccountInfo[];
}

export interface CardSummary {
  id: string;
  kind: 'credit' | 'debit';
  name: string;
  bankName: string | null;
  tier: string;
  maskedNumber: string;
  variant: CardVariant;
  currency: string;
  /** Debit: money in the account. Credit: what is owed. */
  balance: string;
  /** Credit cards only. */
  credit: {
    owed: number;
    limit: number | null;
    available: string | null;
  } | null;
  statementDay: number | null;
  paymentDueDay: number | null;
}

const CREDIT_VARIANTS: CardVariant[] = ['premium', 'stealth'];
const DEBIT_VARIANTS: CardVariant[] = ['platinum', 'virtual'];

/**
 * Credit and debit accounts as cards, credit first. The last digits, limit
 * and available credit come from the account or, when it imports from a
 * bank, from the bank's data.
 */
export function buildCards(
  accounts: ReadonlyArray<ApiAccount>,
  connections: ReadonlyArray<BankConnectionInfo>,
  { locale, t }: Localizer,
): CardSummary[] {
  const linked = new Map<
    string,
    LinkedAccountInfo & { institution: string | null }
  >();
  for (const connection of connections) {
    for (const account of connection.accounts) {
      if (account.accountId) {
        linked.set(account.accountId, {
          ...account,
          institution: connection.institution,
        });
      }
    }
  }

  const cards = accounts.filter(
    (a): a is ApiAccount & { type: 'credit' | 'debit' } =>
      !a.archived && (a.type === 'credit' || a.type === 'debit'),
  );
  cards.sort(
    (a, b) => Number(b.type === 'credit') - Number(a.type === 'credit'),
  );

  let credits = 0;
  let debits = 0;
  return cards.map((account) => {
    const bank = linked.get(account.id);
    const last4 = account.metadata?.last4 ?? bank?.mask ?? null;
    const isCredit = account.type === 'credit';
    const variant = isCredit
      ? CREDIT_VARIANTS[credits++ % CREDIT_VARIANTS.length]!
      : DEBIT_VARIANTS[debits++ % DEBIT_VARIANTS.length]!;

    let credit: CardSummary['credit'] = null;
    if (isCredit) {
      const owed = creditOwed(account);
      const limit = bank?.creditLimit ?? account.metadata?.creditLimit ?? null;
      const available =
        bank?.availableCredit ??
        (limit !== null ? roundCents(Math.max(0, limit - owed)) : null);
      credit = {
        owed,
        limit: limit && limit > 0 ? limit : null,
        available:
          available !== null
            ? formatMoney(available, account.currency, locale)
            : null,
      };
    }

    return {
      id: account.id,
      kind: account.type,
      name: account.name,
      bankName: account.metadata?.bank ?? bank?.institution ?? null,
      tier: t(isCredit ? 'cards.tier.credit' : 'cards.tier.debit'),
      maskedNumber: last4 ? `•••• •••• •••• ${last4}` : '•••• •••• ••••',
      variant,
      currency: account.currency,
      balance: formatMoney(
        isCredit ? credit!.owed : account.balanceCurrent,
        account.currency,
        locale,
      ),
      credit,
      statementDay: account.creditCardTerms?.statementDay ?? null,
      paymentDueDay: account.creditCardTerms?.paymentDueDay ?? null,
    };
  });
}

/** The card in ?card=…, or the first one. */
export function pickCard<T extends { id: string }>(
  cards: ReadonlyArray<T>,
  requested: string | string[] | undefined,
): T | null {
  return cards.find((c) => c.id === requested) ?? cards[0] ?? null;
}

/** "20 oct · En 6 días" */
function dueLabel(
  day: DayKey,
  today: DayKey,
  { locale, t }: Localizer,
): string {
  return t('cards.facts.due', {
    date: shortDate(day, locale),
    relative: relativeDayLabel(day, today, locale),
  });
}

export interface CardMonthSummaryData {
  recurringExpected: number;
  recurringPaid: number;
  recurringPayments: { name: string }[];
  statement: {
    statementDate: string | null;
    paymentDueDate: string | null;
    statementBalance: number | null;
    minimumPayment: number | null;
    noInterestPayment: number | null;
  } | null;
}

export interface CardDetail {
  card: CardSummary;
  monthLabel: string;
  monthSpending: string;
  recent: TransactionRow[];
  /** Label/value pairs: next cut-off, payment date, statement amounts. */
  facts: { label: string; value: string }[];
  recurring: { expected: string; paid: string; count: number } | null;
}

export function buildCardDetail(
  card: CardSummary,
  {
    today,
    monthLabel,
    monthSpending,
    recent,
    summary,
  }: {
    today: DayKey;
    monthLabel: string;
    monthSpending: number;
    recent: TransactionRow[];
    summary: CardMonthSummaryData | null;
  },
  l: Localizer,
): CardDetail {
  const { locale, t } = l;
  const money = (n: number) => formatMoney(n, card.currency, locale);
  const facts: CardDetail['facts'] = [];
  const statement = summary?.statement;

  if (card.statementDay) {
    facts.push({
      label: t('cards.facts.nextStatement'),
      value: dueLabel(nextMonthlyDay(today, card.statementDay), today, l),
    });
  }
  if (statement?.paymentDueDate) {
    facts.push({
      label: t('cards.facts.paymentDue'),
      value: dueLabel(dayKeyOf(statement.paymentDueDate), today, l),
    });
  } else if (card.paymentDueDay) {
    facts.push({
      label: t('cards.facts.nextPayment'),
      value: dueLabel(nextMonthlyDay(today, card.paymentDueDay), today, l),
    });
  }
  if (statement?.statementBalance != null) {
    facts.push({
      label: statement.statementDate
        ? t('cards.facts.statementBalanceOn', {
            date: shortDate(dayKeyOf(statement.statementDate), locale),
          })
        : t('cards.facts.statementBalance'),
      value: money(statement.statementBalance),
    });
  }
  if (statement?.noInterestPayment != null) {
    facts.push({
      label: t('cards.facts.noInterest'),
      value: money(statement.noInterestPayment),
    });
  }
  if (statement?.minimumPayment != null) {
    facts.push({
      label: t('cards.facts.minimum'),
      value: money(statement.minimumPayment),
    });
  }

  return {
    card,
    monthLabel,
    monthSpending: money(monthSpending),
    recent,
    facts,
    recurring:
      summary && summary.recurringPayments.length > 0
        ? {
            expected: money(summary.recurringExpected),
            paid: money(summary.recurringPaid),
            count: summary.recurringPayments.length,
          }
        : null,
  };
}
