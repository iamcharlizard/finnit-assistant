'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AtSign, CircleCheck, User } from 'lucide-react';

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
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import { Label } from '@finnit/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';

import { adminErrorMessage } from '@/lib/admin/errors';
import {
  CREATE_USER_MUTATION,
  MIN_PASSWORD_LENGTH,
  type AdminUser,
  type UserRole,
} from '@/lib/admin/users';
import { gql } from '@/lib/graphql/client';
import { PasswordField } from './password-field';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Agregar usuario". Finnit is invitation-only: this is the only way in.
 * Mounted while open, so every opening starts empty.
 */
export function CreateUserDialog({
  canChooseRole,
  onClose,
  onCreated,
}: {
  /** Only the master names admins. */
  canChooseRole: boolean;
  onClose: () => void;
  onCreated: (user: AdminUser) => void;
}) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<UserRole>('user');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [created, setCreated] = React.useState<AdminUser | null>(null);
  const t = useTranslations();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim().length < 2) {
      found.name = t('admin.users.create.nameRequired');
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      found.email = t('admin.users.create.emailInvalid');
    }
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      found.password = t('admin.users.passwordField.minLengthError', {
        min: String(MIN_PASSWORD_LENGTH),
      });
    }
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const data = await gql<{ createUser: AdminUser }>(CREATE_USER_MUTATION, {
        input: {
          name: name.trim(),
          email: email.trim(),
          password: password || null,
          ...(canChooseRole && { role }),
        },
      });
      setCreated(data.createUser);
      onCreated(data.createUser);
    } catch (error) {
      setSubmitError(adminErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        {created ? (
          <>
            <DialogHeader>
              <CircleCheck aria-hidden className="mb-1 size-8 text-income" />
              <DialogTitle>
                {t('admin.users.create.createdTitle', { name: created.name })}
              </DialogTitle>
              <DialogDescription>
                {created.hasPassword
                  ? t('admin.users.create.createdWithPassword', {
                      email: created.email,
                    })
                  : t('admin.users.create.createdWithGoogle', {
                      email: created.email,
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
              <DialogTitle>{t('admin.users.create.title')}</DialogTitle>
              <DialogDescription>
                {t('admin.users.create.description')}
              </DialogDescription>
            </DialogHeader>

            <InputWithIcon
              label={t('admin.users.create.name')}
              iconLeft={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              placeholder={t('admin.users.create.namePlaceholder')}
              error={errors.name}
            />
            <InputWithIcon
              label={t('admin.users.create.email')}
              iconLeft={AtSign}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              placeholder={t('admin.users.create.emailPlaceholder')}
              error={errors.email}
            />
            <div className="flex flex-col gap-1.5">
              <PasswordField
                label={t('admin.users.create.password')}
                value={password}
                onChange={setPassword}
                error={errors.password}
              />
              <p className="px-1 text-[13px] text-on-surface-variant">
                {password
                  ? t('admin.users.create.withPassword')
                  : t('admin.users.create.withoutPassword')}
              </p>
            </div>

            {canChooseRole ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-user-role" className="px-1">
                  {t('admin.users.create.role')}
                </Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as UserRole)}
                >
                  <SelectTrigger id="new-user-role" className="min-h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      {t('admin.users.roles.user')}
                    </SelectItem>
                    <SelectItem value="admin">
                      {t('admin.users.roles.admin')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

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
                {saving ? t('admin.users.create.adding') : t('admin.users.add')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
