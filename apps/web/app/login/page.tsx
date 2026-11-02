import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Moon, Sun } from 'lucide-react';

import { LoginForm } from '@/components/login-form';
import { ThemeSwitch } from '@/components/theme-switch';
import { loginErrorCode } from '@/lib/auth/google';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.login') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations('settings');
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-16 hidden size-[340px] rounded-full bg-[#6c72cb]/14 blur-3xl dark:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -bottom-20 hidden size-[340px] rounded-full bg-[#00f5ff]/8 blur-3xl dark:block"
      />
      <div className="absolute top-4 right-4 flex items-center gap-2 text-muted-foreground">
        <Sun aria-hidden className="size-4" />
        <ThemeSwitch label={t('darkMode')} />
        <Moon aria-hidden className="size-4" />
      </div>
      <LoginForm
        next={typeof next === 'string' ? next : undefined}
        error={loginErrorCode(error) ?? undefined}
      />
    </div>
  );
}
