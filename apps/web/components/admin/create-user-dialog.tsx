'use client';

import * as React from 'react';
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim().length < 2) found.name = 'Escribe su nombre.';
    if (!EMAIL_PATTERN.test(email.trim()))
      found.email = 'Escribe un correo válido.';
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      found.password = `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
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
      setSubmitError(adminErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <CircleCheck aria-hidden className="mb-1 size-8 text-income" />
              <DialogTitle>Agregaste a {created.name}</DialogTitle>
              <DialogDescription>
                {created.hasPassword
                  ? `Ya puede entrar con ${created.email} y la contraseña que asignaste, o con su cuenta de Google de ese correo. Compártele la contraseña por un canal seguro (en persona o un gestor de contraseñas), no por correo ni chat.`
                  : `Ya puede entrar con su cuenta de Google de ${created.email}.`}
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
              <DialogTitle>Agregar usuario</DialogTitle>
              <DialogDescription>
                El acceso a Finnit es por invitación: solo entra quien agregas
                aquí.
              </DialogDescription>
            </DialogHeader>

            <InputWithIcon
              label="Nombre"
              iconLeft={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              placeholder="Ana López"
              error={errors.name}
            />
            <InputWithIcon
              label="Correo electrónico"
              iconLeft={AtSign}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              placeholder="nombre@ejemplo.com"
              error={errors.email}
            />
            <div className="flex flex-col gap-1.5">
              <PasswordField
                label="Contraseña (opcional)"
                value={password}
                onChange={setPassword}
                error={errors.password}
              />
              <p className="px-1 text-[13px] text-on-surface-variant">
                {password
                  ? 'Puede entrar con esta contraseña o con su cuenta de Google de este correo.'
                  : 'Solo podrá entrar con Google usando este correo.'}
              </p>
            </div>

            {canChooseRole ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-user-role" className="px-1">
                  Rol
                </Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as UserRole)}
                >
                  <SelectTrigger id="new-user-role" className="min-h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
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
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" variant="secondary" disabled={saving}>
                {saving ? 'Agregando…' : 'Agregar usuario'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
