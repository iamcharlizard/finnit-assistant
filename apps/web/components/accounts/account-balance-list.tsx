'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';

import { Card } from '@finnit/ui/components/ui/card';
import { Progress } from '@finnit/ui/components/ui/progress';
import { SyncPill } from '@finnit/ui/components/finance/sync-pill';
import { cn } from '@finnit/ui/lib/utils';

import type { AccountBalanceGroup } from '@finnit/core/accounts/balance-list';

/**
 * Every account with what it has (a card: what it owes, how much of the
 * limit and when it is paid), grouped like the stack. Choosing one selects
 * it, as its card does.
 */
export function AccountBalanceList({
  groups,
  onSelect,
}: {
  groups: ReadonlyArray<AccountBalanceGroup>;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('accounts.balanceList');
  return (
    <section
      aria-labelledby="account-balances-title"
      className="flex flex-col gap-4"
    >
      <h3
        id="account-balances-title"
        className="px-1 text-base font-bold text-on-background"
      >
        {t('title')}
      </h3>
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <h4 className="px-1 text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
            {group.title}
          </h4>
          <ul className="grid gap-2 @3xl:grid-cols-2">
            {group.rows.map((row) => (
              <li key={row.id}>
                <Card className="gap-0 rounded-[20px] p-0">
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    aria-label={t('open', { name: row.label })}
                    className={cn(
                      'flex w-full flex-col gap-2 rounded-[20px] p-4 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      row.archived && 'opacity-70',
                    )}
                  >
                    <span className="flex items-start gap-3">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-on-background">
                          {row.label}
                        </span>
                        <span className="truncate text-xs text-on-surface-variant">
                          {[row.detail, row.archived ? t('archived') : null]
                            .filter(Boolean)
                            .join(' · ') || ' '}
                        </span>
                        <SyncPill sync={row.sync} className="mt-1.5" />
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span
                          className={cn(
                            'text-base font-bold tabular-nums',
                            row.tone === 'expense'
                              ? 'text-expense'
                              : 'text-on-background',
                          )}
                        >
                          {row.amount}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          {row.caption}
                        </span>
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="mt-1 size-4 shrink-0 text-on-surface-variant"
                      />
                    </span>
                    {row.usedPercent != null ? (
                      <Progress
                        value={row.usedPercent}
                        aria-label={row.creditLine ?? row.label}
                        indicatorColor={
                          row.usedPercent >= 90 ? 'var(--expense)' : undefined
                        }
                      />
                    ) : null}
                    {row.creditLine || row.nextPayment ? (
                      <span className="flex flex-wrap justify-between gap-x-3 text-xs text-on-surface-variant">
                        <span>{row.creditLine}</span>
                        <span>{row.nextPayment}</span>
                      </span>
                    ) : null}
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
