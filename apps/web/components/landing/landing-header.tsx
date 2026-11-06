import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { buttonVariants } from '@finnit/ui/components/ui/button';
import { cn } from '@finnit/ui/lib/utils';

import { BrandLogo } from '@/components/brand/finnit-brand';
import { ThemeSwitch } from '@/components/theme-switch';

/** Floating top bar: logo, section links, light/dark and the main action. */
export async function LandingHeader({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations('landing.nav');
  const links = [
    { href: '#features', label: t('features') },
    { href: '#how', label: t('how') },
    { href: '#trust', label: t('trust') },
  ];
  return (
    <header className="sticky top-3 z-40 px-4">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 rounded-full border border-glass-border bg-glass px-4 shadow-elevation glass sm:px-6">
        <Link href="/" aria-label="Finnit" className="shrink-0">
          <BrandLogo className="h-7 w-auto" priority />
        </Link>
        <nav
          aria-label={t('features')}
          className="hidden flex-1 justify-center md:flex"
        >
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-accent hover:text-on-background"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <span className="flex items-center gap-1.5 text-on-surface-variant">
            <Sun aria-hidden className="hidden size-4 sm:block" />
            <ThemeSwitch label={t('darkMode')} />
            <Moon aria-hidden className="hidden size-4 sm:block" />
          </span>
          {signedIn ? (
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: 'sm' }), 'min-h-10 px-5')}
            >
              {t('myAccount')}
            </Link>
          ) : (
            <>
              {/* The hero's form from @4xl; on phones, the one at the end. */}
              <a
                href="#waitlist"
                className={cn(
                  buttonVariants({ size: 'sm' }),
                  'hidden min-h-10 px-5 @4xl:inline-flex',
                )}
              >
                {t('join')}
              </a>
              <a
                href="#join"
                className={cn(
                  buttonVariants({ size: 'sm' }),
                  'min-h-10 px-5 @4xl:hidden',
                )}
              >
                {t('join')}
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
