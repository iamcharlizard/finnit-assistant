/**
 * "Todas las cuentas" → Resumen: every account with what it has (or, a
 * credit card, what it owes), without opening each one. Grouped like the
 * stack: credit cards, then debit accounts, then savings and cash.
 */
import { nextMonthlyDay } from '../finance/accounts';
import { shortDate, type DayKey } from '../finance/dates';
import { formatMoney } from '../finance/money';
import type { Localizer } from '../i18n/translator';
import {
  ACCOUNT_GROUPS,
  type AccountGroupKey,
  type AccountSummary,
} from './view';

export interface AccountBalanceRow {
  id: string;
  label: string;
  /** "BBVA · •1234" */
  detail: string;
  /** What it has, or a card owes. */
  amount: string;
  /** Under the amount: "Disponible" or "Debes". */
  caption: string;
  /** Below zero (a debit account), or a card that owes. */
  tone: 'default' | 'expense';
  /** Credit cards with a limit: how much of it is used (0–100). */
  usedPercent: number | null;
  /** "Disponible $3,891.68 de $77,000.00" */
  creditLine: string | null;
  /** "Pago 9 dic" */
  nextPayment: string | null;
  archived: boolean;
  includedInTotal: boolean;
  /** How it updates (a pill): "Manual", "Automática · hace 2 h"… */
  sync: AccountSummary['sync'];
}

export interface AccountBalanceGroup {
  key: AccountGroupKey;
  title: string;
  rows: AccountBalanceRow[];
}

export function buildAccountBalanceList(
  accounts: ReadonlyArray<AccountSummary>,
  today: DayKey,
  { locale, t }: Localizer,
): AccountBalanceGroup[] {
  const row = (account: AccountSummary): AccountBalanceRow => {
    const credit = account.credit;
    const limit = credit?.limit ?? null;
    return {
      id: account.id,
      label: account.label,
      detail: [account.bankName, account.last4 ? `•${account.last4}` : null]
        .filter(Boolean)
        .join(' · '),
      amount: account.balance,
      sync: account.sync,
      caption: t(credit ? 'accounts.cardOwed' : 'accounts.cardAvailable'),
      tone: credit
        ? credit.owed > 0
          ? 'expense'
          : 'default'
        : account.amount < 0
          ? 'expense'
          : 'default',
      usedPercent:
        credit && limit
          ? Math.min(100, Math.max(0, Math.round((credit.owed / limit) * 100)))
          : null,
      creditLine:
        credit?.available && limit
          ? t('accounts.balanceList.creditLine', {
              available: credit.available,
              limit: formatMoney(limit, account.currency, locale),
            })
          : null,
      nextPayment:
        credit && account.paymentDueDay
          ? t('accounts.balanceList.nextPayment', {
              date: shortDate(
                nextMonthlyDay(today, account.paymentDueDay),
                locale,
              ),
            })
          : null,
      archived: account.archived,
      includedInTotal: account.includedInTotal,
    };
  };

  return ACCOUNT_GROUPS.map((key) => ({
    key,
    title: t(`accounts.balanceList.groups.${key}`),
    rows: accounts.filter((a) => a.group === key).map(row),
  })).filter((group) => group.rows.length > 0);
}
