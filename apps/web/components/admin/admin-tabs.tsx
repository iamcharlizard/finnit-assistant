'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Users, type LucideIcon } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/ai', label: 'IA', icon: Sparkles },
];

/** Sub-navigation of /admin (one route per tab). */
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones de administración"
      className="flex w-fit gap-1 rounded-full bg-track p-1"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
              active
                ? 'bg-surface text-on-background shadow-xs'
                : 'text-on-surface-variant hover:text-on-background',
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
