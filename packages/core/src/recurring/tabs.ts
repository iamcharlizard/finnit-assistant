/** The sections of "Pagos recurrentes", one visible at a time. */
export const RECURRING_TABS = ['calendar', 'list', 'suggestions'] as const;
export type RecurringTab = (typeof RECURRING_TABS)[number];

const DEFAULT_TAB: RecurringTab = 'calendar';

/** `?tab=` → a known tab; anything else is the calendar. */
export function parseTabParam(
  value: string | string[] | undefined,
): RecurringTab {
  return typeof value === 'string' &&
    (RECURRING_TABS as readonly string[]).includes(value)
    ? (value as RecurringTab)
    : DEFAULT_TAB;
}

/** `search` (e.g. "?view=week&date=…") with `tab` set; the calendar is left out. */
export function withTabParam(search: string, tab: RecurringTab): string {
  const params = new URLSearchParams(search);
  if (tab === DEFAULT_TAB) params.delete('tab');
  else params.set('tab', tab);
  const query = params.toString();
  return query ? `?${query}` : '';
}
