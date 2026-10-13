/**
 * The top bar's title for each route. Patterns use Next's segment syntax:
 * `[id]` matches one segment, `[...rest]` one or more. The first match wins,
 * so specific routes go before dynamic ones.
 */
export type PageTitleKey =
  | 'app'
  | 'history'
  | 'transaction'
  | 'categorize'
  | 'recurring'
  | 'cards'
  | 'analytics'
  | 'statements'
  | 'settings'
  | 'banks'
  | 'aliases'
  | 'connectBank'
  | 'admin';

export const PAGE_TITLES: ReadonlyArray<
  [pattern: string, title: PageTitleKey]
> = [
  ['/dashboard', 'app'],
  ['/history', 'history'],
  ['/transactions/categorize', 'categorize'],
  ['/transactions/[id]', 'transaction'],
  ['/recurring', 'recurring'],
  ['/recurring/[...rest]', 'recurring'],
  // Redirects to /recurring; kept for the moment before the redirect.
  ['/calendar', 'recurring'],
  ['/accounts', 'cards'],
  ['/analytics', 'analytics'],
  ['/statements', 'statements'],
  ['/statements/[...rest]', 'statements'],
  ['/settings', 'settings'],
  ['/settings/banks', 'banks'],
  ['/settings/banks/connect', 'connectBank'],
  ['/settings/aliases', 'aliases'],
  ['/admin', 'admin'],
  ['/admin/[...rest]', 'admin'],
];

/** Whether `pathname` matches a route pattern like "/transactions/[id]". */
export function matchRoute(pattern: string, pathname: string): boolean {
  const want = pattern.split('/').filter(Boolean);
  const have = pathname.split('/').filter(Boolean);
  for (let i = 0; i < want.length; i++) {
    const segment = want[i]!;
    if (/^\[\.\.\.[^\]]+\]$/.test(segment)) return have.length > i;
    if (have[i] === undefined) return false;
    if (/^\[[^\]]+\]$/.test(segment)) continue;
    if (segment !== have[i]) return false;
  }
  return have.length === want.length;
}

/** The title key for a path ("app" — just "Finnit" — when none matches). */
export function pageTitleKey(
  pathname: string,
  titles: ReadonlyArray<[string, PageTitleKey]> = PAGE_TITLES,
): PageTitleKey {
  return (
    titles.find(([pattern]) => matchRoute(pattern, pathname))?.[1] ?? 'app'
  );
}
