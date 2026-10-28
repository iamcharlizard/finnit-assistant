import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // @finnit/ui ships TypeScript source, so Next compiles it.
  transpilePackages: ['@finnit/ui'],
  experimental: {
    // proxy.ts runs before /api/files and Next buffers request bodies for it
    // (10 MB by default, truncating the rest). Uploads are up to 10 MB plus
    // multipart overhead; /api/files rejects anything above 10.5 MB itself.
    proxyClientMaxBodySize: '11mb',
  },
  async redirects() {
    // "Mis tarjetas" became "Cuentas y tarjetas"; the query (?card=…) is kept.
    // The payments calendar became "Pagos recurrentes"; /recurring reads
    // the old ?month=YYYY-MM.
    return [
      { source: '/cards', destination: '/accounts', permanent: false },
      { source: '/calendar', destination: '/recurring', permanent: false },
    ];
  },
};

// Reads the request config from ./i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
