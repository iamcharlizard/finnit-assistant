/**
 * The public address of the site, for canonical links, the sitemap and
 * link previews. FINNIT_SITE_URL wins; on Vercel, the production domain;
 * locally, the dev server.
 */
export function siteUrl(): URL {
  const explicit = process.env.FINNIT_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL('http://localhost:3001');
}
