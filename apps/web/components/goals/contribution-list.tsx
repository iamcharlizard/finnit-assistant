import { useTranslations } from 'next-intl';
import { Link2, Trash2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import type { ContributionItem } from '@/lib/goals/view';

/** The goal's contributions, newest first, each removable. */
export function ContributionList({
  items,
  busyId,
  onRemove,
}: {
  items: ContributionItem[];
  busyId: string | null;
  onRemove: (item: ContributionItem) => void;
}) {
  const t = useTranslations('goals.contributions');
  if (items.length === 0) {
    return <p className="text-sm text-on-surface-variant">{t('empty')}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-outline/60">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-bold text-on-background tabular-nums">
              {item.amount}
            </span>
            <span className="flex items-center gap-1 text-xs text-on-surface-variant">
              {item.dateLabel}
              {item.linked ? (
                <>
                  {' · '}
                  <Link2 aria-hidden className="size-3" />
                  {t('linked')}
                </>
              ) : null}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={busyId === item.id}
            aria-label={t('remove', {
              amount: item.amount,
              date: item.dateLabel,
            })}
            onClick={() => onRemove(item)}
          >
            <Trash2 aria-hidden className="text-expense" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
