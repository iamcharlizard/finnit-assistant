/**
 * Paging of "Por clasificar" (the history's review mode, formerly
 * "Clasificar movimientos"). The filters themselves are the history's
 * (`history/filters.ts` with `review`), sent to the API as they are.
 */

/** The API's TransactionFilters, as the history builds them. */
export type ApiTransactionFilters = object;

export const CATEGORIZE_PAGE_SIZE = 30;
/** The API's largest page; "refresh" reloads at most this many rows. */
export const MAX_PAGE_SIZE = 100;

/** Variables of the page query: the first page, the next one, or a reload. */
export function pageVariables(
  filters: ApiTransactionFilters,
  { after = null, loaded = 0 }: { after?: string | null; loaded?: number } = {},
): { first: number; after: string | null; filters: ApiTransactionFilters } {
  return {
    // A reload asks again for what is on screen, within the API's limit.
    first: Math.min(Math.max(loaded, CATEGORIZE_PAGE_SIZE), MAX_PAGE_SIZE),
    after,
    filters,
  };
}
