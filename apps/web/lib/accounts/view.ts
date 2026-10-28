import type { CardVariant } from '@finnit/ui/components/finance/bank-payment-card';

import type { Localizer, Translate } from '@/lib/i18n/translator';
import {
  accountDesign,
  accountLabel,
  creditOwed,
  nextMonthlyDay,
} from '@/lib/finance/accounts';
import {
  dayKeyOf,
  relativeDayLabel,
  shortDate,
  type DayKey,
} from '@/lib/finance/dates';
import { formatMoney, roundCents } from '@/lib/finance/money';
import type { TransactionRow } from '@/lib/finance/transactions';
import type { AccountType, ApiAccount } from '@/lib/finance/types';
import type { AccountEditValues } from './form';

/** A linked bank account as bankConnections returns it. */
export interface LinkedAccountInfo {
  accountId: string | null;
  name: string | null;
  mask: string | null;
  creditLimit: number | null;
  availableCredit: number | null;
}

export interface BankConnectionInfo {
  institution: string | null;
  accounts: LinkedAccountInfo[];
}

export const BANK_CONNECTIONS_FIELDS =
  'institution accounts { accountId name mask creditLimit availableCredit }';

/** Sections of "Cuentas y tarjetas", in this order. */
export const ACCOUNT_GROUPS = ['credit', 'debit', 'savings'] as const;
export type AccountGroupKey = (typeof ACCOUNT_GROUPS)[number];

/** Credit cards; debit and cash; savings and e-wallets. */
export function groupOf(type: AccountType): AccountGroupKey {
  if (type === 'credit') return 'credit';
  if (type === 'debit' || type === 'cash') return 'debit';
  return 'savings';
}

export interface AccountSummary {
  id: string;
  type: AccountType;
  group: AccountGroupKey;
  /** Nickname, or the account's name. */
  label: string;
  /** The account's own name (shown under a nickname). */
  name: string;
  bankName: string | null;
  last4: string | null;
  tier: string;
  maskedNumber: string;
  /** Preset look when the user hasn't chosen colors. */
  variant: CardVariant;
  primaryColor: string | null;
  secondaryColor: string | null;
  /** Imported from a bank connection ("Conectada") or added by hand. */
  linked: boolean;
  archived: boolean;
  currency: string;
  /** Debit/cash/savings: money in the account. Credit: what is owed. */
  balance: string;
  /** Credit cards only. */
  credit: {
    owed: number;
    limit: number | null;
    available: string | null;
  } | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  interestRateAnnual: number | null;
  /** Starting point of the edit dialog. */
  edit: AccountEditValues;
}

const VARIANTS: Record<AccountGroupKey, CardVariant[]> = {
  credit: ['premium', 'stealth'],
  debit: ['platinum', 'virtual'],
  savings: ['virtual', 'platinum'],
};

/** "BBVA" from linked data or the account; "•••• •••• •••• 1234". */
export function maskedNumberOf(
  type: AccountType,
  last4: string | null,
): string {
  if (type === 'cash') return '';
  if (type === 'savings' || type === 'ewallet') {
    return last4 ? `•••• ${last4}` : '';
  }
  return last4 ? `•••• •••• •••• ${last4}` : '•••• •••• ••••';
}

/**
 * Every account as a card, by section (credit, debit and cash, savings),
 * newest first inside each. Archived ones only with `showArchived`. The
 * last digits, limit and available credit come from the account or, when it
 * imports from a bank, from the bank's data.
 */
export function buildAccounts(
  accounts: ReadonlyArray<ApiAccount>,
  connections: ReadonlyArray<BankConnectionInfo>,
  { locale, t }: Localizer,
  { showArchived = false }: { showArchived?: boolean } = {},
): AccountSummary[] {
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

  const visible = accounts
    .filter((a) => showArchived || !a.archived)
    .map((account, index) => ({ account, index }))
    .sort(
      (a, b) =>
        ACCOUNT_GROUPS.indexOf(groupOf(a.account.type)) -
          ACCOUNT_GROUPS.indexOf(groupOf(b.account.type)) ||
        Number(a.account.archived) - Number(b.account.archived) ||
        a.index - b.index,
    )
    .map(({ account }) => account);

  const used: Record<AccountGroupKey, number> = {
    credit: 0,
    debit: 0,
    savings: 0,
  };
  return visible.map((account) => {
    const bank = linked.get(account.id);
    const group = groupOf(account.type);
    const last4 = account.metadata?.last4 ?? bank?.mask ?? null;
    const isCredit = account.type === 'credit';
    const variants = VARIANTS[group];
    const variant = variants[used[group]++ % variants.length]!;
    const design = accountDesign(account);
    const terms = account.creditCardTerms;

    let credit: AccountSummary['credit'] = null;
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
      type: account.type,
      group,
      label: accountLabel(account),
      name: account.name,
      bankName: account.metadata?.bank ?? bank?.institution ?? null,
      last4,
      tier: t(`accounts.tier.${account.type}`),
      maskedNumber: maskedNumberOf(account.type, last4),
      variant,
      primaryColor: design?.primaryColor ?? null,
      secondaryColor: design?.secondaryColor ?? null,
      linked: Boolean(bank),
      archived: account.archived,
      currency: account.currency,
      balance: formatMoney(
        isCredit ? credit!.owed : account.balanceCurrent,
        account.currency,
        locale,
      ),
      credit,
      statementDay: terms?.statementDay ?? null,
      paymentDueDay: terms?.paymentDueDay ?? null,
      interestRateAnnual: terms?.interestRateAnnual ?? null,
      edit: {
        type: account.type,
        linked: Boolean(bank),
        archived: account.archived,
        nickname: account.metadata?.nickname ?? null,
        design,
        bank: account.metadata?.bank ?? null,
        last4: account.metadata?.last4 ?? null,
        creditLimit: account.metadata?.creditLimit ?? null,
        terms: terms
          ? {
              statementDay: terms.statementDay,
              paymentDueDay: terms.paymentDueDay,
              interestRateAnnual: terms.interestRateAnnual ?? null,
            }
          : null,
      },
    };
  });
}

export interface AccountGroup {
  key: AccountGroupKey;
  title: string;
  accounts: AccountSummary[];
}

/** Non-empty sections, in ACCOUNT_GROUPS order. */
export function groupAccounts(
  accounts: ReadonlyArray<AccountSummary>,
  t: Translate,
): AccountGroup[] {
  return ACCOUNT_GROUPS.map((key) => ({
    key,
    title: t(`accounts.groups.${key}`),
    accounts: accounts.filter((a) => a.group === key),
  })).filter((g) => g.accounts.length > 0);
}

/** The account in ?account=… (or the legacy ?card=…), or the first one. */
export function pickAccount<T extends { id: string }>(
  accounts: ReadonlyArray<T>,
  requested: string | string[] | undefined,
): T | null {
  return accounts.find((c) => c.id === requested) ?? accounts[0] ?? null;
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

export interface AccountDetail {
  account: AccountSummary;
  monthLabel: string;
  monthSpending: string;
  recent: TransactionRow[];
  /** Label/value pairs: next cut-off, payment date, statement amounts. */
  facts: { label: string; value: string }[];
  recurring: { expected: string; paid: string; count: number } | null;
}

export function buildAccountDetail(
  card: AccountSummary,
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
): AccountDetail {
  const { locale, t } = l;
  const money = (n: number) => formatMoney(n, card.currency, locale);
  const facts: AccountDetail['facts'] = [];
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
  if (card.interestRateAnnual != null) {
    facts.push({
      label: t('cards.facts.interestRate'),
      value: t('cards.facts.percent', {
        rate: String(card.interestRateAnnual),
      }),
    });
  }

  return {
    account: card,
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

/** What the card preview needs (wizard and edit dialog). */
export type CardPreview = Pick<
  AccountSummary,
  | 'type'
  | 'tier'
  | 'label'
  | 'bankName'
  | 'maskedNumber'
  | 'variant'
  | 'balance'
>;

export function cardPreview(
  {
    type,
    label,
    bankName,
    last4,
    balance,
    currency,
  }: {
    type: AccountType;
    label: string;
    bankName: string | null;
    last4: string | null;
    balance: number;
    currency: string;
  },
  { locale, t }: Localizer,
): CardPreview {
  return {
    type,
    tier: t(`accounts.tier.${type}`),
    label,
    bankName,
    maskedNumber: maskedNumberOf(type, last4),
    variant: VARIANTS[groupOf(type)][0]!,
    balance: formatMoney(Math.abs(balance), currency, locale),
  };
}
