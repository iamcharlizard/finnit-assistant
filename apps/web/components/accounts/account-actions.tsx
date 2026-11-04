'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';
import { cn } from '@finnit/ui/lib/utils';

export interface AccountAction {
  key: string;
  icon: LucideIcon;
  label: string;
  /** A link, or `onSelect` for an action on this page. */
  href?: string;
  onSelect?: () => void;
}

/**
 * The account's actions: `buttons` (with their text) show only when the
 * detail is wide; `menu`, a round "…" with the same items, only on narrow
 * screens. Render both where each belongs.
 */
export function AccountActions({
  actions,
  accountLabel,
  display,
  className,
}: {
  actions: AccountAction[];
  accountLabel: string;
  display: 'buttons' | 'menu';
  className?: string;
}) {
  const t = useTranslations('accounts');
  if (display === 'buttons') {
    return (
      <div
        className={cn(
          'hidden flex-wrap items-center gap-2 @3xl:flex',
          className,
        )}
      >
        {actions.map(({ key, icon: Icon, label, href, onSelect }) =>
          href ? (
            <Button key={key} variant="outline" size="sm" asChild>
              <Link href={href}>
                <Icon aria-hidden /> {label}
              </Link>
            </Button>
          ) : (
            <Button key={key} variant="outline" size="sm" onClick={onSelect}>
              <Icon aria-hidden /> {label}
            </Button>
          ),
        )}
      </div>
    );
  }
  return (
    <div className="@3xl:hidden">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('actionsLabel', { name: accountLabel })}
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map(({ key, icon: Icon, label, href, onSelect }) =>
            href ? (
              <DropdownMenuItem key={key} asChild>
                <Link href={href}>
                  <Icon aria-hidden /> {label}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={key} onSelect={onSelect}>
                <Icon aria-hidden /> {label}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
