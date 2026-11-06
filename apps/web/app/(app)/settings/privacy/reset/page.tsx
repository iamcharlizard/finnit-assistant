import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PrivacyResetScreen } from '@/components/privacy/privacy-reset-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.privacyReset') };
}

/** The emailed "forgot my privacy PIN" link lands here. */
export default async function PrivacyResetPage({
  searchParams,
}: PageProps<'/settings/privacy/reset'>) {
  const { token } = await searchParams;
  return (
    <PrivacyResetScreen
      token={
        typeof token === 'string' && /^[\w-]{20,100}$/.test(token)
          ? token
          : null
      }
    />
  );
}
