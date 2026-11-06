'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, LockKeyhole, LockKeyholeOpen } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import { lockPrivacy } from '@/app/privacy-actions';
import { ForgotPinButton } from '@/components/privacy/forgot-pin-button';
import { PrivacyPinDialog } from '@/components/privacy/privacy-pin-dialog';
import { useSessionUser } from '@/components/session-provider';

/** Settings → Seguridad: the privacy PIN (create, change, forgot, lock now). */
export function PrivacySettings() {
  const t = useTranslations('privacy.settings');
  const router = useRouter();
  const { privacy } = useSessionUser();
  const hasPin = Boolean(privacy?.hasPin);
  const unlocked = Boolean(privacy?.unlocked);
  const [editing, setEditing] = React.useState(false);
  const [locking, startLock] = React.useTransition();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl bg-track px-3 text-left text-on-surface-variant outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex items-center gap-3">
          <LockKeyhole aria-hidden className="size-5 shrink-0" />
          <span className="flex flex-col">
            <span className="text-base text-on-background">
              {t(hasPin ? 'change' : 'create')}
            </span>
            <span className="text-xs">{t('hint')}</span>
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0" />
      </button>
      {hasPin ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <ForgotPinButton />
          {unlocked ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locking}
              onClick={() =>
                startLock(async () => {
                  await lockPrivacy();
                  router.refresh();
                })
              }
            >
              <LockKeyholeOpen aria-hidden /> {t('lockNow')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {editing ? (
        <PrivacyPinDialog hasPin={hasPin} onClose={() => setEditing(false)} />
      ) : null}
    </div>
  );
}
