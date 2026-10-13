import { accountLabel } from '@/lib/finance/accounts';
import type { EntryAccount, EntryCategory } from './graphql';

/**
 * What the create flow's pickers list: accounts (by the user's nickname)
 * and categories grouped under their parent.
 */
export interface PickerOption {
  value: string;
  label: string;
  group?: string;
  keywords?: string[];
}

/** "BBVA Azul · 1234" style detail: nickname or name, plus the last digits. */
export function accountOptionLabel(account: EntryAccount): string {
  const last4 = account.metadata?.last4?.trim();
  const label = accountLabel(account);
  return last4 && !label.includes(last4) ? `${label} · ${last4}` : label;
}

/** Non-archived accounts, in the order given (the API's). */
export function accountOptions(
  accounts: ReadonlyArray<EntryAccount>,
  filter: (account: EntryAccount) => boolean = () => true,
): PickerOption[] {
  return accounts
    .filter((account) => !account.archived && filter(account))
    .map((account) => ({
      value: account.id,
      label: accountOptionLabel(account),
      keywords: [
        account.name,
        account.metadata?.bank ?? '',
        account.currency,
      ].filter(Boolean),
    }));
}

const INCOME_KEY = 'categories.income';
const isIncomeRoot = (c: EntryCategory) => c.key === INCOME_KEY;

/**
 * Categories for the combobox: each top-level category is a group holding
 * itself and its subcategories. For an income the income group comes
 * first; for an expense it goes last. Names come from the API in the user's
 * language and are sorted alphabetically within each group.
 */
export function categoryOptions(
  categories: ReadonlyArray<EntryCategory>,
  type: 'expense' | 'income',
  locale: string,
): PickerOption[] {
  const ids = new Set(categories.map((c) => c.id));
  const roots = categories.filter((c) => !c.parentId || !ids.has(c.parentId));
  const byName = (a: EntryCategory, b: EntryCategory) =>
    a.name.localeCompare(b.name, locale);
  const rank = (c: EntryCategory) =>
    isIncomeRoot(c) ? (type === 'income' ? -1 : 1) : 0;
  const ordered = [...roots].sort((a, b) => rank(a) - rank(b) || byName(a, b));

  return ordered.flatMap((root) => {
    const children = categories
      .filter((c) => c.parentId === root.id)
      .sort(byName);
    return [root, ...children].map((category) => ({
      value: category.id,
      label: category.name,
      group: root.name,
      keywords: category === root ? [] : [root.name],
    }));
  });
}

/**
 * Accounts money can leave in a transfer. Credit cards are left out: the
 * API refuses a transfer larger than the source's balance, and a card's
 * balance is what it owes (zero or negative).
 */
export function transferSources(
  accounts: ReadonlyArray<EntryAccount>,
): PickerOption[] {
  return accountOptions(accounts, (a) => a.type !== 'credit');
}

/** Where the money can go: any other account in the same currency. */
export function transferTargets(
  accounts: ReadonlyArray<EntryAccount>,
  fromAccountId: string | undefined,
): PickerOption[] {
  const from = accounts.find((a) => a.id === fromAccountId);
  return accountOptions(
    accounts,
    (a) => a.id !== fromAccountId && (!from || a.currency === from.currency),
  );
}

/**
 * A transfer into a credit card is a card payment: it lowers what the card
 * owes (its balance moves toward zero).
 */
export function isCardPayment(
  accounts: ReadonlyArray<EntryAccount>,
  toAccountId: string | undefined,
): boolean {
  return accounts.find((a) => a.id === toAccountId)?.type === 'credit';
}
