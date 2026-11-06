'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LockKeyhole } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { unlockPrivacy } from '@/app/privacy-actions';
import { PinField } from '@/components/privacy/pin-field';
import { ForgotPinButton } from '@/components/privacy/forgot-pin-button';
import { isValidPin } from '@/lib/privacy/pin';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * Asks for the privacy PIN. On success the server keeps the unlock in an
 * httpOnly cookie for 10 minutes and the page reloads its data (protected
 * patterns and bank texts show). Mounted while open.
 */
export function PrivacyUnlockDialog({
  onClose,
  onUnlocked,
  reason,
}: {
  onClose: () => void;
  onUnlocked?: () => void;
  /** What the PIN opens (shown under the title). */
  reason?: string;
}) {
  const exit = useDialogExit();
  const t = useTranslations('privacy.unlock');
  const { t: translate } = useLocalizer();
  const router = useRouter();
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidPin(pin)) {
      setError(t('errors.invalid'));
      return;
    }
    startTransition(async () => {
      const result = await unlockPrivacy(pin);
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        setPin('');
        return;
      }
      router.refresh();
      exit.after(() => onUnlocked?.())();
    });
  }

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !pending && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={translate('common.close')}
        className="sm:max-w-sm"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockKeyhole aria-hidden className="size-5" /> {t('title')}
            </DialogTitle>
            <DialogDescription>{reason ?? t('description')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <PinField
              label={t('pin')}
              value={pin}
              onChange={(value) => {
                setPin(value);
                setError(null);
              }}
              error={error ?? undefined}
              autoFocus
            />
            <ForgotPinButton />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                {translate('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !pin}>
              {pending ? t('checking') : t('confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
