import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Landmark, LockKeyhole, ShieldCheck, Unplug } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

const POINTS = [
  { icon: LockKeyhole, key: 'credentials' },
  { icon: Landmark, key: 'data' },
  { icon: Unplug, key: 'disconnect' },
] as const;

export function ConsentStep({ onAccept }: { onAccept: () => void }) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent-neon/15 text-accent-neon">
          <ShieldCheck aria-hidden className="size-6" />
        </span>
        <TitleLg as="h2">{t('bankConnect.consent.title')}</TitleLg>
      </div>

      <ul className="flex flex-col gap-4">
        {POINTS.map(({ icon: Icon, key }) => (
          <li key={key} className="flex gap-3">
            <Icon
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-brand-ink"
            />
            <BodyMd className="text-on-surface-variant">
              {t(`bankConnect.consent.${key}`)}
            </BodyMd>
          </li>
        ))}
      </ul>

      <BodyMd className="text-[13px] text-on-surface-variant">
        {t('bankConnect.consent.agreement')}
      </BodyMd>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" asChild>
          <Link href="/settings/banks">{t('common.cancel')}</Link>
        </Button>
        <Button variant="secondary" onClick={onAccept}>
          {t('bankConnect.consent.accept')}
        </Button>
      </div>
    </div>
  );
}
