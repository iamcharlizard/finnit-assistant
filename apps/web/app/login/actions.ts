'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ApiUnavailableError, apiSignIn } from '@/lib/api/finnit-api';
import { clearSession, writeSession } from '@/lib/auth/cookies';
import { safeNextPath } from '@/lib/auth/redirect';

export type SignInState = { error?: string; email?: string };

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const remember = formData.get('remember') === 'on';

  if (!email || !password) {
    return { error: 'Por favor completa todos los campos.', email };
  }

  let session: Awaited<ReturnType<typeof apiSignIn>>;
  try {
    session = await apiSignIn(email, password);
  } catch (error) {
    return {
      error:
        error instanceof ApiUnavailableError
          ? 'No pudimos conectar con Finnit. Intenta de nuevo en un momento.'
          : 'Ocurrió un error al iniciar sesión.',
      email,
    };
  }
  // Same message for unknown email and wrong password (no account probing).
  if (!session) {
    return { error: 'Correo o contraseña incorrectos.', email };
  }

  writeSession(await cookies(), session, remember);
  redirect(safeNextPath(formData.get('next')));
}

export async function signOut(): Promise<void> {
  clearSession(await cookies());
  redirect('/login');
}
