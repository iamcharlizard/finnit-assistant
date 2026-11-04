'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Inbox } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Card } from '@finnit/ui/components/ui/card';

import { EmptyState } from '@/components/finance/empty-state';
import { TransactionRow } from '@/components/finance/transaction-row';
import { useFillViewport } from '@/hooks/use-fill-viewport';
import type { TransactionRow as TransactionRowData } from '@/lib/finance/transactions';

/** Space under the list: the page's bottom padding (lg:pb-10) and the card's border. */
const BOTTOM_GAP = 41;
/** Below this the list would be too short to use; the page scrolls instead. */
const MIN_LIST_HEIGHT = 192;

/**
 * The account's latest movements. On wide screens the list takes the space
 * left down to the bottom of the window and scrolls inside, so the page
 * doesn't; on phones it is about four rows tall.
 */
export function AccountMovements({
  rows,
  historyHref,
  dayLabel = null,
}: {
  rows: TransactionRowData[];
  /** "Movimientos" with the same filter. */
  historyHref: string;
  /** A past day: the list holds that day's movements. */
  dayLabel?: string | null;
}) {
  const t = useTranslations('accounts.detail');
  const tc = useTranslations('cards');
  const listRef = useFillViewport<HTMLDivElement>({
    bottomGap: BOTTOM_GAP,
    minHeight: MIN_LIST_HEIGHT,
  });

  return (
    <Card className="gap-0 overflow-hidden rounded-[20px] p-0">
      <div className="flex items-center justify-between gap-3 border-b border-glass-border px-4.5 py-3">
        <h3 className="text-sm font-bold text-on-background">
          {dayLabel ? t('dayMovements', { date: dayLabel }) : t('movements')}
        </h3>
        {rows.length > 0 ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={historyHref}>
              {t('seeAll')} <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
      {rows.length > 0 ? (
        <div
          ref={listRef}
          // Scrollable region: reachable with the keyboard.
          tabIndex={0}
          aria-label={t('movements')}
          // A grid, not a flex column: flex items would shrink to fit the
          // max height and squash the rows.
          className="grid max-h-[22rem] content-start gap-2 overflow-y-auto p-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {rows.map((row) => (
            <TransactionRow key={row.id} row={row} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Inbox}
          title={tc('noMovementsTitle')}
          description={tc('noMovementsDescription')}
          className="m-3"
        />
      )}
    </Card>
  );
}
