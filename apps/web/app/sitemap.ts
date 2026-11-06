import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/landing/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL('/', siteUrl()).toString(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
