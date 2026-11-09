/** The account's own page (web route; the app maps it with appHref). */
export function accountCardHref(accountId: string): string {
  return `/accounts/${encodeURIComponent(accountId)}`;
}
