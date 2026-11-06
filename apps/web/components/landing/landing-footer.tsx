import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { BrandLogo } from '@/components/brand/finnit-brand';

export async function LandingFooter() {
  const t = await getTranslations('landing.footer');
  return (
    <footer className="px-6 pt-6 pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 border-t border-outline pt-8 @2xl:flex-row @2xl:items-center @2xl:justify-between">
        <div>
          <BrandLogo className="h-6 w-auto" />
          <p className="mt-2 text-sm text-on-surface-variant">{t('tagline')}</p>
        </div>
        <div className="flex flex-col gap-1 text-sm text-on-surface-variant @2xl:items-end">
          <p>
            {t('haveInvite')}{' '}
            <Link
              href="/login"
              className="font-medium text-brand-ink underline-offset-4 hover:underline"
            >
              {t('signIn')}
            </Link>
          </p>
          <p>{t('rights', { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
