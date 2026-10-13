'use client';

import { useTranslations } from 'next-intl';
import { Lock, Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { Switch } from '@finnit/ui/components/ui/switch';
import { cn } from '@finnit/ui/lib/utils';

import type { ApiMerchantAlias } from '@/lib/aliases/types';

/** One alias rule: name, how it matches, category, flags and its actions. */
export function AliasCard({
  alias,
  busy,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  alias: ApiMerchantAlias;
  busy: boolean;
  onToggleActive: (active: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('aliases');
  const details = [
    alias.category?.name ?? t('noCategory'),
    t('matches', { count: alias.matchCount }),
    alias.priority !== 0 ? t('priority', { priority: alias.priority }) : null,
  ].filter(Boolean);

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
            {alias.isPrivate ? (
              <Badge variant="muted">{t('private')}</Badge>
            ) : null}
            {!alias.active ? (
              <Badge variant="outline">{t('inactive')}</Badge>
            ) : null}
          </h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            {t(`matchShort.${alias.matchType}`)}:{' '}
            <code className="rounded bg-track px-1 py-0.5 font-mono text-[11px] break-all text-on-background">
              {alias.pattern}
            </code>
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {details.join(' · ')}
          </p>
        </div>
        <Switch
          checked={alias.active}
          disabled={busy}
          onCheckedChange={onToggleActive}
          aria-label={t('activeLabel', { name: alias.displayName })}
        />
      </div>
      <div className="flex justify-end gap-1">
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
      </div>
    </article>
  );
}
