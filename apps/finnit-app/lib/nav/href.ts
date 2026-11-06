/**
 * A query parameter of a web-style href from @finnit/core ("/analytics?month=2026-10"),
 * without URLSearchParams (React Native only half-implements it).
 */
export function hrefParam(href: string, name: string): string | undefined {
  const query = href.split('?')[1];
  if (!query) return undefined;
  for (const part of query.split('&')) {
    const [key, value = ''] = part.split('=');
    if (decodeURIComponent(key!) === name) return decodeURIComponent(value.replace(/\+/g, ' '));
  }
  return undefined;
}
