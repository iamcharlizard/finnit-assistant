import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @finnit/ui ships TypeScript source, so Next compiles it.
  transpilePackages: ['@finnit/ui'],
};

export default nextConfig;
