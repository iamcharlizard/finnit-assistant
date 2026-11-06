import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';

import { AiFeatures } from '@/components/landing/ai-features';
import { AppPreview } from '@/components/landing/app-preview';
import { ClosingCta } from '@/components/landing/closing-cta';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingHeader } from '@/components/landing/landing-header';
import { Trust } from '@/components/landing/trust';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';
import { intlLocale } from '@finnit/core/i18n/locales';
import { campaignSource } from '@/lib/landing/waitlist';
import { siteUrl } from '@/lib/landing/site-url';

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([
    getTranslations('landing.meta'),
    getLocale(),
  ]);
  const title = t('title');
  const description = t('description');
  return {
    metadataBase: siteUrl(),
    title: { absolute: title },
    description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      url: '/',
      siteName: 'Finnit',
      title,
      description,
      locale: intlLocale(locale).replace('-', '_'),
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

/**
 * Public landing page: what Finnit is, and a waitlist (access stays
 * invitation-only). Shown to everyone; signed-in users also get a link to
 * their account. The proxy treats `/` as public (lib/auth/route-access.ts).
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, store] = await Promise.all([searchParams, cookies()]);
  // The proxy already renewed or cleared the session, so the cookie is enough.
  const signedIn = store.has(ACCESS_COOKIE);
  const source = campaignSource(params);
  return (
    <div className="landing @container relative min-h-dvh overflow-x-clip">
      <LandingHeader signedIn={signedIn} />
      <main>
        <Hero source={source} />
        <AiFeatures />
        <HowItWorks />
        <AppPreview />
        <Trust />
        <ClosingCta source={source} />
      </main>
      <LandingFooter />
    </div>
  );
}
