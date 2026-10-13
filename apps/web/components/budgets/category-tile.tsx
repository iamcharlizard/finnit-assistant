import { cn } from '@finnit/ui/lib/utils';

import type { IconKey } from '@/lib/finance/categories';
import { CATEGORY_ICONS } from '@/lib/finance/category-icons';

/** A category's icon on a tile of its color. */
export function CategoryTile({
  iconKey,
  color,
  className,
}: {
  iconKey: IconKey;
  color: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[iconKey];
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-chip',
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
      }}
    >
      <Icon className="size-5" style={{ color }} />
    </span>
  );
}
