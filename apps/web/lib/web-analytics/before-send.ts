/**
 * What Vercel Web Analytics may see. Page views keep only the path: query
 * strings carry filters, months and `next=` redirects, nothing we need to
 * count visits. Admin screens are not counted at all. (Dynamic segments are
 * already reported as their route, e.g. /accounts/[id].)
 */
interface AnalyticsEvent {
  url: string;
}

const PRIVATE_PREFIXES = ['/admin'];

export function redactAnalyticsEvent<E extends AnalyticsEvent>(
  event: E,
): E | null {
  let url: URL;
  try {
    url = new URL(event.url);
  } catch {
    return null;
  }
  const path = url.pathname;
  if (PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return null;
  }
  // Campaign tags on the landing are the one query we keep: they say which
  // post or ad brought the visit (UTM reports need Web Analytics Plus).
  const kept = new URLSearchParams();
  if (path === '/') {
    for (const [key, value] of url.searchParams) {
      if (key.startsWith('utm_') || key === 'ref') kept.set(key, value);
    }
  }
  const query = kept.toString();
  return { ...event, url: `${url.origin}${path}${query ? `?${query}` : ''}` };
}
