'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

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
import { toast } from '@finnit/ui/components/ui/toaster';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { PinField } from '@/components/privacy/pin-field';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { PIN_MAX, PIN_MIN, isValidPin } from '@finnit/core/privacy/pin';

const SET_PIN_MUTATION = `mutation SetPrivacyPin($input: SetPrivacyPinInput!) { setPrivacyPin(input: $input) }`;
const RESET_PIN_MUTATION = `mutation ResetPrivacyPin($token: String!, $pin: String!) { resetPrivacyPin(token: $token, pin: $pin) }`;

/**
 * Creates or changes the privacy PIN (the current one is asked to change
 * it), or sets a new one with a reset link (`resetToken`). Mounted while open.
 */
export function PrivacyPinDialog({
  hasPin,
  resetToken,
  onClose,
  onSaved,
}: {
  hasPin: boolean;
  resetToken?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const exit = useDialogExit();
  const t = useTranslations('privacy.pinDialog');
  const { t: translate } = useLocalizer();
  const router = useRouter();
  const askCurrent = hasPin && !resetToken;
  const [current, setCurrent] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [repeat, setRepeat] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidPin(pin)) {
      setError(t('errors.length', { min: PIN_MIN, max: PIN_MAX }));
      return;
    }
    if (pin !== repeat) {
      setError(t('errors.mismatch'));
      return;
    }
    if (askCurrent && !current) {
      setError(t('errors.current'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (resetToken) {
        await gql(RESET_PIN_MUTATION, { token: resetToken, pin });
      } else {
        await gql(SET_PIN_MUTATION, {
          input: { pin, currentPin: askCurrent ? current : null },
        });
      }
      toast.success(t(hasPin || resetToken ? 'changed' : 'created'));
      router.refresh();
      exit.after(() => onSaved?.())();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(
        /wrong pin/i.test(message)
          ? t('errors.wrongCurrent')
          : /too many/i.test(message)
            ? translate('privacy.unlock.errors.paused')
            : /no longer valid/i.test(message)
              ? t('errors.link')
              : requestErrorMessage(e, translate),
      );
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !saving && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={translate('common.close')}
        className="sm:max-w-sm"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {t(hasPin || resetToken ? 'changeTitle' : 'createTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('description', { min: PIN_MIN, max: PIN_MAX })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {askCurrent ? (
              <PinField
                label={t('current')}
                value={current}
                onChange={setCurrent}
                autoFocus
              />
            ) : null}
            <PinField
              label={t('new')}
              value={pin}
              onChange={setPin}
              autoComplete="new-password"
              autoFocus={!askCurrent}
            />
            <PinField
              label={t('repeat')}
              value={repeat}
              onChange={setRepeat}
              autoComplete="new-password"
            />
            {error ? (
              <p role="alert" className="text-sm text-expense">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {translate('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
