import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PartyPopper } from 'lucide-react';
import type { ConnectedBank } from '@finnit/bank-connect';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

export function DoneStep({
  bank,
  linked,
}: {
  bank: ConnectedBank;
  linked: number;
}) {
  const t = useTranslations('bankConnect.done');
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-income/15 text-income">
        <PartyPopper aria-hidden className="size-7" />
      </span>
      <TitleLg as="h2">
        {t('title', { bank: bank.institution ?? t('yourBank') })}
      </TitleLg>
      <BodyMd className="max-w-md text-on-surface-variant">
        {linked ? t('linked', { count: linked }) : t('noneLinked')}
      </BodyMd>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" asChild>
          <Link href="/settings/banks">{t('connectedBanks')}</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/history">{t('seeMovements')}</Link>
        </Button>
      </div>
    </div>
  );
}
