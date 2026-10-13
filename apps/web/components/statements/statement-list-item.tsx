import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight, FileText, TriangleAlert } from 'lucide-react';

import type { StatementListItem as Item } from '@/lib/statements/view';
import { StatementStatusBadge } from './statement-status-badge';

/** One uploaded statement: card, period, status, balance and any mismatch. */
export function StatementListItem({ item }: { item: Item }) {
  const t = useTranslations('statements');
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-3 rounded-2xl bg-surface p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-chip bg-track">
          <FileText aria-hidden className="size-5 text-on-surface-variant" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-on-background">
              {item.account}
            </span>
            <StatementStatusBadge
              status={item.status}
              label={item.statusLabel}
            />
          </span>
          <span className="mt-0.5 block text-xs text-on-surface-variant">
            {item.period} · {t('uploadedOn', { date: item.uploadedOn })}
          </span>
          {item.balance ? (
            <span className="mt-0.5 block text-xs text-on-surface-variant">
              {t('balance', { amount: item.balance })}
            </span>
          ) : null}
          {item.difference ? (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-expense">
              <TriangleAlert aria-hidden className="size-3.5" />
              {t('differenceShort', { amount: item.difference })}
            </span>
          ) : null}
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-on-surface-variant"
        />
      </Link>
    </li>
  );
}
