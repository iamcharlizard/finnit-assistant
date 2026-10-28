import { cn } from '@finnit/ui/lib/utils';

import { ICON_COLORS } from '@/lib/finance/categories';
import { CATEGORY_ICONS } from '@/lib/finance/category-icons';
import { recurringKindIcon } from '@/lib/finance/payments';
import type { RecurringKind } from '@/lib/finance/types';

/** The kind of a recurring expense as a colored icon tile. */
export function KindIcon({
  kind,
  className,
}: {
  kind: RecurringKind;
  className?: string;
}) {
  const key = recurringKindIcon(kind);
  const Icon = CATEGORY_ICONS[key];
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-chip',
        className,
      )}
      style={{ backgroundColor: ICON_COLORS[key] }}
    >
      <Icon className="size-5 text-white" />
    </span>
  );
}
