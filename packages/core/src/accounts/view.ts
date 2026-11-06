import type { CardVariant } from '../ui/bank-card';

import type { Localizer } from '../i18n/translator';
import {
  accountDesign,
  accountLabel,
  creditOwed,
  nextMonthlyDay,
} from '../finance/accounts';
import {
  dayKeyOf,
  relativeDayLabel,
  shortDate,
  type DayKey,
} from '../finance/dates';
import { formatMoney, roundCents } from '../finance/money';
import type { TransactionRow } from '../finance/transactions';
import type {
  AccountType,
  ApiAccount,
  ApiUpcomingPayment,
} from '../finance/types';
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
  /** The user's nickname for it, if any: the card's title. */
  nickname: string | null;
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
  /** `balance` as a number. */
  amount: number;
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
      nickname: account.metadata?.nickname?.trim() || null,
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
      amount: isCredit ? credit!.owed : account.balanceCurrent,
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

/** The account in ?account=… (or the legacy ?card=…), or the first one. */
export function pickAccount<T extends { id: string }>(
  accounts: ReadonlyArray<T>,
  requested: string | string[] | undefined,
): T | null {
  return accounts.find((c) => c.id === requested) ?? accounts[0] ?? null;
}

/** A date and how far it is: "20 oct" · "En 6 días". */
export interface DateFact {
  date: string;
  relative: string;
}

function dateFact(
  day: DayKey,
  today: DayKey,
  locale: Localizer['locale'],
): DateFact {
  return {
    date: shortDate(day, locale),
    relative: relativeDayLabel(day, today, locale),
  };
}

export const PENDING_CHARGE_FIELDS =
  'dueDate expectedAmount status recurringExpense { currency }';

export interface CardMonthSummaryData {
  statement: {
    statementDate: string | null;
    paymentDueDate: string | null;
    statementBalance: number | null;
    minimumPayment: number | null;
    noInterestPayment: number | null;
  } | null;
}

/** A recurring payment charged to the account, as upcomingPayments returns it. */
export type PendingCharge = Pick<
  ApiUpcomingPayment,
  'dueDate' | 'expectedAmount' | 'status'
> & {
  recurringExpense: Pick<ApiUpcomingPayment['recurringExpense'], 'currency'>;
};

export interface AccountDetail {
  account: AccountSummary;
  recent: TransactionRow[];
  /** "Movimientos" filtered by this account. */
  historyHref: string;
  /** Credit cards with a limit. */
  limit: string | null;
  /** Credit cards with a limit: share used, 0–100. */
  usedPercent: number | null;
  /** Next cut-off (credit cards with a statement day). */
  statementDate: DateFact | null;
  /** The statement's due date, else the next payment day. */
  paymentDate: DateFact | null;
  /**
   * Balance (or debt) at the end of the month: today's, minus (plus, on a
   * credit card) the recurring payments still due on this account.
   */
  projection: {
    amount: string;
    /** A debit account that would end below zero. */
    short: boolean;
    pendingCount: number;
    pendingTotal: string;
  };
  /** Statement amounts and the interest rate. */
  facts: { label: string; value: string }[];
}

export function buildAccountDetail(
  card: AccountSummary,
  {
    today,
    recent,
    summary,
    pending,
  }: {
    today: DayKey;
    recent: TransactionRow[];
    summary: CardMonthSummaryData | null;
    /** Recurring payments due from today to the end of the month. */
    pending: ReadonlyArray<PendingCharge>;
  },
  { locale, t }: Localizer,
): AccountDetail {
  const money = (n: number) => formatMoney(n, card.currency, locale);
  const statement = summary?.statement;
  const isCredit = card.credit !== null;

  // Paid or skipped ones are done; reminders (no status) still count.
  const due = pending.filter(
    (p) =>
      (p.status === null || p.status === 'upcoming') &&
      p.recurringExpense.currency === card.currency &&
      dayKeyOf(p.dueDate) >= today,
  );
  const pendingTotal = roundCents(
    due.reduce((sum, p) => sum + p.expectedAmount, 0),
  );
  const projected = roundCents(
    isCredit ? card.amount + pendingTotal : card.amount - pendingTotal,
  );

  const facts: AccountDetail['facts'] = [];
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

  const limit = card.credit?.limit ?? null;
  const paymentDay = statement?.paymentDueDate
    ? dayKeyOf(statement.paymentDueDate)
    : card.paymentDueDay
      ? nextMonthlyDay(today, card.paymentDueDay)
      : null;

  return {
    account: card,
    recent,
    historyHref: `/history?account=${encodeURIComponent(card.id)}`,
    limit: limit !== null ? money(limit) : null,
    usedPercent:
      limit !== null
        ? Math.min(100, Math.max(0, Math.round((card.amount / limit) * 100)))
        : null,
    statementDate: card.statementDay
      ? dateFact(nextMonthlyDay(today, card.statementDay), today, locale)
      : null,
    paymentDate: paymentDay ? dateFact(paymentDay, today, locale) : null,
    projection: {
      amount: money(projected),
      short: !isCredit && projected < 0,
      pendingCount: due.length,
      pendingTotal: money(pendingTotal),
    },
    facts,
  };
}

/** What the card preview needs (wizard and edit dialog). */
export type CardPreview = Pick<
  AccountSummary,
  | 'type'
  | 'tier'
  | 'label'
  | 'nickname'
  | 'bankName'
  | 'maskedNumber'
  | 'variant'
  | 'balance'
>;

export function cardPreview(
  {
    type,
    label,
    nickname,
    bankName,
    last4,
    balance,
    currency,
  }: {
    type: AccountType;
    label: string;
    nickname: string | null;
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
    nickname,
    bankName,
    maskedNumber: maskedNumberOf(type, last4),
    variant: VARIANTS[groupOf(type)][0]!,
    balance: formatMoney(Math.abs(balance), currency, locale),
  };
}
