import { STATUS_COLORS, type CapStatus } from '@finnit/core/budgets/status';
import { Progress } from '@finnit/ui-native/components/ui/progress';

/** How much of a limit is used, colored by status (80% warning, 100% over). */
export function UsageBar({
  percent,
  status,
  label,
  className,
}: {
  percent: number;
  status: CapStatus;
  label: string;
  className?: string;
}) {
  return (
    <Progress value={percent} indicatorColor={STATUS_COLORS[status]} accessibilityLabel={label} className={className} />
  );
}
