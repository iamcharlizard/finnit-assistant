'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { KeyRound } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import { EmptyState } from '@/components/finance/empty-state';
import { PageHeader } from '@/components/page-header';
import { PrivacyPinDialog } from '@/components/privacy/privacy-pin-dialog';

/** Choosing a new privacy PIN from the emailed link. */
export function PrivacyResetScreen({ token }: { token: string | null }) {
  const t = useTranslations('privacy.reset');
  const [open, setOpen] = React.useState(Boolean(token));
  const [done, setDone] = React.useState(false);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        back={{ href: '/settings', label: t('back') }}
      />
      <div className="mx-auto w-full max-w-md">
        {!token ? (
          <EmptyState
            icon={KeyRound}
            title={t('invalidTitle')}
            description={t('invalidDescription')}
            action={{ href: '/settings', label: t('back') }}
          />
        ) : done ? (
          <EmptyState
            icon={KeyRound}
            title={t('doneTitle')}
            description={t('doneDescription')}
            action={{ href: '/settings', label: t('back') }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-on-surface-variant">
              {t('description')}
            </p>
            <Button onClick={() => setOpen(true)}>{t('choose')}</Button>
            <Button variant="ghost" asChild>
              <Link href="/settings">{t('back')}</Link>
            </Button>
          </div>
        )}
      </div>
      {open && token ? (
        <PrivacyPinDialog
          hasPin
          resetToken={token}
          onClose={() => setOpen(false)}
          onSaved={() => setDone(true)}
        />
      ) : null}
    </div>
  );
}
