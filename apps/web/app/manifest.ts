import type { MetadataRoute } from 'next';

/** Install metadata (home screen / PWA) with the brand icons in public/brand/. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Finnit',
    short_name: 'Finnit',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f8f9fa',
    theme_color: '#f8f9fa',
    icons: [
      {
        src: '/brand/finnit-icon-light-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/brand/finnit-icon-light-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
