'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  Lock,
  LockKeyhole,
  Pencil,
  Trash2,
} from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { Switch } from '@finnit/ui/components/ui/switch';
import { cn } from '@finnit/ui/lib/utils';

import type { ApiMerchantAlias } from '@finnit/core/aliases/types';
import { formatMoney } from '@finnit/core/finance/money';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * One automatic name: the name, what it looks for (hidden while protected
 * and locked), category, flags, this month's and year's spending and its
 * actions. A locked one asks for the PIN (`onUnlock`) before any change.
 */
export function AliasCard({
  alias,
  busy,
  transferAccount,
  historyHref,
  onToggleActive,
  onEdit,
  onDelete,
  onUnlock,
}: {
  alias: ApiMerchantAlias;
  busy: boolean;
  /** Name of the account it sends movements to, if any. */
  transferAccount?: string;
  /** History filtered by this automatic name. */
  historyHref: string;
  onToggleActive: (active: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onUnlock: () => void;
}) {
  const t = useTranslations('aliases');
  const { locale } = useLocalizer();
  const locked = alias.locked;
  const details = [
    alias.category?.name ?? t('noCategory'),
    t('matches', { count: alias.matchCount }),
    alias.priority !== 0 ? t('priority', { priority: alias.priority }) : null,
  ].filter(Boolean);
  const money = (amount: number, currency: string) =>
    formatMoney(amount, currency, locale);

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-card bg-surface p-4',
        !alias.active && 'opacity-75',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-medium text-on-background">
            {alias.isPrivate ? (
              <Lock
                aria-hidden
                className="size-4 shrink-0 text-on-surface-variant"
              />
            ) : null}
            <span className="min-w-0 break-words">{alias.displayName}</span>
            {alias.isProtected ? (
              <Badge variant="highlight">
                <LockKeyhole aria-hidden /> {t('protected')}
              </Badge>
            ) : alias.isPrivate ? (
              <Badge variant="muted">{t('private')}</Badge>
            ) : null}
            {!alias.active ? (
              <Badge variant="outline">{t('inactive')}</Badge>
            ) : null}
          </h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            {locked || alias.pattern === null ? (
              <span className="italic">{t('lockedPattern')}</span>
            ) : (
              <>
                {t(`matchShort.${alias.matchType}`)}:{' '}
                <code className="rounded bg-track px-1 py-0.5 font-mono text-[11px] break-all text-on-background">
                  {alias.pattern}
                </code>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {details.join(' · ')}
          </p>
          {transferAccount ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-on-surface-variant">
              <ArrowLeftRight aria-hidden className="size-3.5" />
              {t('transferTo', { account: transferAccount })}
            </p>
          ) : null}
          {alias.month ? (
            <p className="mt-2 text-sm text-on-background">
              {t('spending.month', {
                amount: money(alias.month.total, alias.month.currency),
                count: alias.month.count,
              })}
              {alias.year && alias.year.count > 0 ? (
                <span className="text-on-surface-variant">
                  {' · '}
                  {t('spending.year', {
                    amount: money(alias.year.total, alias.year.currency),
                  })}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <Switch
          checked={alias.active}
          disabled={busy}
          onCheckedChange={(active) =>
            locked ? onUnlock() : onToggleActive(active)
          }
          aria-label={t('activeLabel', { name: alias.displayName })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <Button variant="link" size="sm" asChild className="px-0">
          <Link href={historyHref}>{t('spending.view')}</Link>
        </Button>
        <div className="flex gap-1">
          {locked ? (
            <Button variant="outline" size="sm" onClick={onUnlock}>
              <LockKeyhole aria-hidden /> {t('unlock')}
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                aria-label={t('editLabel', { name: alias.displayName })}
              >
                <Pencil aria-hidden /> {t('edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-expense"
                disabled={busy}
                onClick={onDelete}
                aria-label={t('deleteLabel', { name: alias.displayName })}
              >
                <Trash2 aria-hidden /> {t('delete')}
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
