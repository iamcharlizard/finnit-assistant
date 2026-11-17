/**
 * Screens with tabs kept in `?tab=` (no navigation): "Pagos recurrentes"
 * (its expenses, the suggestions and the analytics), the payments
 * "Calendario" (the calendar and the summary with charts), "Cuentas y
 * tarjetas" (balances and analytics) and a credit card's page.
 */
export const RECURRING_TABS = ['list', 'suggestions', 'analytics'] as const;
export type RecurringTab = (typeof RECURRING_TABS)[number];

export const CALENDAR_TABS = ['calendar', 'summary'] as const;
export type CalendarTab = (typeof CALENDAR_TABS)[number];

/** "Cuentas y tarjetas" with every account together. */
export const ACCOUNTS_TABS = ['summary', 'analytics'] as const;
export type AccountsTab = (typeof ACCOUNTS_TABS)[number];

/** A credit card's own page. */
export const CARD_TABS = ['summary', 'movements', 'plans'] as const;
export type CardTab = (typeof CARD_TABS)[number];

/** `?tab=` → one of `tabs`; anything else is the first (the default). */
export function parseTab<T extends string>(
  tabs: readonly [T, ...T[]],
  value: string | string[] | undefined,
): T {
  return typeof value === 'string' &&
    (tabs as readonly string[]).includes(value)
    ? (value as T)
    : tabs[0];
}

/** `search` (e.g. "?view=week&date=…") with `tab` set; the default is left out. */
export function withTab<T extends string>(
  tabs: readonly [T, ...T[]],
  search: string,
  tab: T,
): string {
  const params = new URLSearchParams(search);
  if (tab === tabs[0]) params.delete('tab');
  else params.set('tab', tab);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** "Pagos recurrentes": `?tab=` → a known tab; anything else is the list. */
export function parseTabParam(
  value: string | string[] | undefined,
): RecurringTab {
  return parseTab(RECURRING_TABS, value);
}

export function withTabParam(search: string, tab: RecurringTab): string {
  return withTab(RECURRING_TABS, search, tab);
}
