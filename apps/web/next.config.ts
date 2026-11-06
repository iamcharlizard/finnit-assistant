import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // @finnit/ui and @finnit/core ship TypeScript source, so Next compiles them.
  transpilePackages: ['@finnit/ui', '@finnit/core'],
  experimental: {
    // proxy.ts runs before /api/files and Next buffers request bodies for it
    // (10 MB by default, truncating the rest). Uploads are up to 10 MB plus
    // multipart overhead; /api/files rejects anything above 10.5 MB itself.
    proxyClientMaxBodySize: '11mb',
  },
  async redirects() {
    // "Mis tarjetas" became "Cuentas y tarjetas"; the query (?card=…) is kept.
    // The payments calendar has its own screen again (/calendar): old
    // /recurring links to the calendar (its tab, a view or a day) go there,
    // with their query.
    const toCalendar = ['view', 'date', 'month'].map((key) => ({
      source: '/recurring',
      has: [{ type: 'query' as const, key }],
      destination: '/calendar',
      permanent: false,
    }));
    return [
      { source: '/cards', destination: '/accounts', permanent: false },
      {
        source: '/recurring',
        has: [{ type: 'query', key: 'tab', value: 'calendar' }],
        destination: '/calendar',
        permanent: false,
      },
      ...toCalendar,
    ];
  },
};

// Reads the request config from ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
