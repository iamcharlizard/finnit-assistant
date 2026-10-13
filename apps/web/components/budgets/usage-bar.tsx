import { Progress } from '@finnit/ui/components/ui/progress';
import { cn } from '@finnit/ui/lib/utils';

import { STATUS_COLORS, type CapStatus } from '@/lib/budgets/status';

/** How much of a limit is used, colored by status (80% warning, 100% over). */
export function UsageBar({
  percent,
  status,
  label,
  className,
}: {
  percent: number;
  status: CapStatus;
  /** Accessible name. */
  label: string;
  className?: string;
}) {
  return (
    <Progress
      value={percent}
      indicatorColor={STATUS_COLORS[status]}
      aria-label={label}
      aria-valuetext={`${percent}%`}
      className={cn('h-2', className)}
    />
  );
}
