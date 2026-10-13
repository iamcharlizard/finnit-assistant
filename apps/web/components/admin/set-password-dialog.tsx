'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';

import { adminErrorMessage } from '@/lib/admin/errors';
import {
  MIN_PASSWORD_LENGTH,
  SET_USER_PASSWORD_MUTATION,
  type AdminUser,
} from '@/lib/admin/users';
import { gql } from '@/lib/graphql/client';
import { PasswordField } from './password-field';

/** "Asignar contraseña": a new password for someone (ends their sessions). */
export function SetPasswordDialog({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
}) {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const t = useTranslations();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        t('admin.users.passwordField.minLengthError', {
          min: String(MIN_PASSWORD_LENGTH),
        }),
      );
      return;
    }
    setError(undefined);
    setSaving(true);
    setSubmitError(null);
    try {
      const data = await gql<{ setUserPassword: AdminUser }>(
        SET_USER_PASSWORD_MUTATION,
        { id: user.id, input: { password } },
      );
      if (isSelf) {
        // Your own sessions just ended too: sign in again with it.
        window.location.assign('/login');
        return;
      }
      onSaved(data.setUserPassword);
      setSaved(true);
    } catch (e) {
      setSubmitError(adminErrorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        {saved ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('admin.users.setPassword.savedTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('admin.users.setPassword.savedDescription', {
                  name: user.name,
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">{t('common.done')}</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>{t('admin.users.setPassword.title')}</DialogTitle>
              <DialogDescription>
                {isSelf
                  ? t('admin.users.setPassword.selfDescription')
                  : t('admin.users.setPassword.description', {
                      name: user.name,
                      email: user.email,
                    })}
              </DialogDescription>
            </DialogHeader>
            <PasswordField
              label={t('admin.users.setPassword.newPassword')}
              value={password}
              onChange={setPassword}
              error={error}
            />
            {submitError ? (
              <p role="alert" className="text-[13px] text-expense">
                {submitError}
              </p>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" variant="secondary" disabled={saving}>
                {saving
                  ? t('admin.users.setPassword.saving')
                  : t('admin.users.setPassword.title')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
