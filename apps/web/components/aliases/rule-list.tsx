'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, Trash2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import type { ApiMerchantRule } from '@/lib/aliases/types';

/** "Reglas de categoría aprendidas": merchant → category, with its uses. */
export function RuleList({
  rules,
  busyId,
  onDelete,
}: {
  rules: ApiMerchantRule[];
  busyId: string | null;
  onDelete: (rule: ApiMerchantRule) => void;
}) {
  const t = useTranslations('aliases.rules');
  return (
    <section aria-labelledby="learned-rules" className="flex flex-col gap-3">
      <div>
        <h2 id="learned-rules" className="text-lg font-bold text-on-background">
          {t('title')}
        </h2>
        <p className="text-sm text-on-surface-variant">{t('description')}</p>
      </div>
      {rules.length === 0 ? (
        <p className="rounded-card bg-track p-4 text-center text-sm text-on-surface-variant">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-outline rounded-card bg-surface">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center gap-3 py-2 pr-2 pl-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                <code className="truncate font-mono text-xs text-on-background">
                  {rule.pattern}
                </code>
                <ArrowRight
                  aria-hidden
                  className="hidden size-3.5 shrink-0 text-on-surface-variant sm:block"
                />
                <span className="truncate text-sm font-medium text-on-background">
                  {rule.category.name}
                </span>
              </div>
              <span className="shrink-0 text-xs text-on-surface-variant">
                {t('hits', { count: rule.hits })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-expense"
                disabled={busyId === rule.id}
                onClick={() => onDelete(rule)}
                aria-label={t('deleteLabel', { pattern: rule.pattern })}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
