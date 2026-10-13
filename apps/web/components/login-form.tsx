'use client';

import * as React from 'react';
import { ArrowRight, AtSign, Eye, EyeOff, Lock, Wallet } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Checkbox } from '@finnit/ui/components/ui/checkbox';
import { GlassCard } from '@finnit/ui/components/ui/glass-card';
import { GoogleIcon } from '@finnit/ui/components/ui/google-icon';
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import { BodyMd, HeadlineLg } from '@finnit/ui/components/ui/typography';

import { signIn, type SignInState } from '@/app/login/actions';

export function LoginForm({
  next,
  error,
}: {
  next?: string;
  /** Message for a failed Google sign-in (`/login?error=`). */
  error?: string;
}) {
  const [state, formAction, isSubmitting] = React.useActionState<
    SignInState,
    FormData
  >(signIn, {});
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(false);

  // The Google route keeps "Mantener sesión iniciada" and where to go next.
  const googleParams = new URLSearchParams();
  if (next) googleParams.set('next', next);
  if (remember) googleParams.set('remember', '1');
  const googleHref = `/api/auth/google${googleParams.size ? `?${googleParams}` : ''}`;
  const message = state.error ?? error;

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
        <form action={formAction} noValidate className="flex flex-col gap-5">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <InputWithIcon
            label="Correo electrónico"
            iconLeft={AtSign}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nombre@ejemplo.com"
            defaultValue={state.email}
            required
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
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />

          <div className="flex min-h-11 items-center gap-3 px-1">
            <Checkbox
              id="remember"
              name="remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
            />
            <label
              htmlFor="remember"
              className="text-sm text-on-surface-variant"
            >
              Mantener sesión iniciada
            </label>
          </div>

          {message ? (
            <p
              role="alert"
              aria-live="polite"
              className="px-1 text-[13px] text-expense"
            >
              {message}
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

        {/* A plain link: the route handler redirects to Google (no prefetch). */}
        <Button variant="outline" className="w-full rounded-[14px]" asChild>
          <a href={googleHref}>
            <GoogleIcon className="size-[18px]" /> Google
          </a>
        </Button>
      </GlassCard>

      <p className="mt-8 text-center text-sm text-on-surface-variant">
        El acceso a Finnit es por invitación. Pide acceso al administrador.
      </p>
    </div>
  );
}
