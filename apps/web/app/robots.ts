import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/landing/site-url';

/** Only the landing page is meant for search engines; the app is private. */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: ['/$', '/opengraph-image', '/twitter-image'],
      disallow: '/',
    },
    sitemap: new URL('/sitemap.xml', base).toString(),
  };
}
