'use client';

import * as React from 'react';

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`);
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
      setSubmitError(adminErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {saved ? (
          <>
            <DialogHeader>
              <DialogTitle>Contraseña asignada</DialogTitle>
              <DialogDescription>
                {user.name} ya puede entrar con la nueva contraseña.
                Compártesela por un canal seguro (en persona o un gestor de
                contraseñas), no por correo ni chat.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Listo</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>Asignar contraseña</DialogTitle>
              <DialogDescription>
                {isSelf
                  ? 'Tu contraseña cambiará y se cerrarán tus sesiones abiertas, incluida esta.'
                  : `Reemplaza la contraseña de ${user.name} (${user.email}) y cierra sus sesiones abiertas.`}
              </DialogDescription>
            </DialogHeader>
            <PasswordField
              label="Nueva contraseña"
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
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" variant="secondary" disabled={saving}>
                {saving ? 'Guardando…' : 'Asignar contraseña'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
