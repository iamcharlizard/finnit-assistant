'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Apple,
  ArrowRight,
  AtSign,
  Eye,
  EyeOff,
  Lock,
  Wallet,
} from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Checkbox } from '@finnit/ui/components/ui/checkbox';
import { GlassCard } from '@finnit/ui/components/ui/glass-card';
import { GoogleIcon } from '@finnit/ui/components/ui/google-icon';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import { BodyMd, HeadlineLg } from '@finnit/ui/components/ui/typography';

type LoginFormState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string };

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [formState, setFormState] = React.useState<LoginFormState>({
    status: 'idle',
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setFormState({
        status: 'error',
        message: 'Por favor completa todos los campos.',
      });
      return;
    }
    // TODO: call the `signIn` mutation; UI-only for now (mock data phase).
    setFormState({ status: 'submitting' });
    router.push('/dashboard');
  }

  const isSubmitting = formState.status === 'submitting';

  return (
    <div className="relative w-full max-w-[440px]">
      <div className="mb-10 flex flex-col items-center">
        <span className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-accent-neon text-white shadow-[0_4px_20px_rgba(108,114,203,0.35)] dark:text-[#00363a] dark:shadow-[0_0_30px_rgba(0,245,255,0.45)]">
          <Wallet aria-hidden className="size-9" />
        </span>
        <HeadlineLg as="h1" className="text-center text-accent-neon">
          Bienvenido de nuevo
        </HeadlineLg>
        <BodyMd className="mt-2 text-center text-on-surface-variant">
          Gestiona tus finanzas con precisión Finnit.
        </BodyMd>
      </div>

      <GlassCard className="rounded-[28px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-5"
        >
          <InputWithIcon
            label="Correo electrónico"
            iconLeft={AtSign}
            type="email"
            autoComplete="email"
            placeholder="nombre@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <InputWithIcon
            label="Contraseña"
            labelAction={
              <a
                href="#"
                className="flex min-h-11 items-center text-xs font-medium tracking-wide text-accent-neon hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </a>
            }
            iconLeft={Lock}
            iconRight={showPassword ? EyeOff : Eye}
            iconRightAccessibilityLabel={
              showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
            onIconRightClick={() => setShowPassword((v) => !v)}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex min-h-11 items-center gap-3 px-1">
            <Checkbox id="remember" />
            <label
              htmlFor="remember"
              className="text-sm text-on-surface-variant"
            >
              Mantener sesión iniciada
            </label>
          </div>

          {formState.status === 'error' ? (
            <p
              role="alert"
              aria-live="polite"
              className="px-1 text-[13px] text-expense"
            >
              {formState.message}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="secondary"
            size="lg"
            disabled={isSubmitting}
            className="w-full rounded-[14px] text-lg dark:shadow-[0_0_22px_rgba(0,245,255,0.55)]"
          >
            {isSubmitting ? 'Verificando…' : 'Iniciar sesión'}
            {!isSubmitting ? <ArrowRight className="size-5" /> : null}
          </Button>
        </form>

        <div className="my-8 flex items-center gap-4">
          <span className="h-px flex-1 bg-outline" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-on-surface-variant">
            O continuar con
          </span>
          <span className="h-px flex-1 bg-outline" />
        </div>

        <div className="flex gap-4">
          <Button variant="outline" className="flex-1 rounded-[14px]">
            <GoogleIcon className="size-[18px]" /> Google
          </Button>
          <Button variant="outline" className="flex-1 rounded-[14px]">
            <Apple className="size-[18px]" /> Apple
          </Button>
        </div>
      </GlassCard>

      <p className="mt-8 flex flex-wrap items-center justify-center gap-1 text-sm text-on-surface-variant">
        ¿No tienes una cuenta?
        <a
          href="#"
          className="flex min-h-11 items-center font-medium text-accent-neon hover:underline"
        >
          Regístrate ahora
        </a>
      </p>
    </div>
  );
}
