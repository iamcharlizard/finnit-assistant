'use client';

import { useTranslations } from 'next-intl';
import { CloudOff } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

/** A screen whose data could not load (API down or an error answer). */
export default function AppError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations();
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center"
    >
      <CloudOff aria-hidden className="size-10 text-on-surface-variant/60" />
      <p className="text-base font-medium text-on-background">
        {t('errors.loadFailedTitle')}
      </p>
      <p className="text-sm text-on-surface-variant">
        {t('errors.loadFailedDescription')}
      </p>
      <Button variant="outline" onClick={reset}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
