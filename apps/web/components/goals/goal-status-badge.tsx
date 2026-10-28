import { useTranslations } from 'next-intl';
import {
  AlarmClock,
  CalendarOff,
  CircleCheck,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';

import type { GoalStatus } from '@/lib/goals/status';

const STYLE: Record<
  GoalStatus,
  {
    icon: LucideIcon;
    variant: 'success' | 'income' | 'expense' | 'highlight' | 'muted';
  }
> = {
  reached: { icon: CircleCheck, variant: 'success' },
  onTrack: { icon: TrendingUp, variant: 'income' },
  behind: { icon: TrendingDown, variant: 'highlight' },
  overdue: { icon: AlarmClock, variant: 'expense' },
  noDueDate: { icon: CalendarOff, variant: 'muted' },
};

/** "En camino", "Atrasada", "Alcanzada"…: icon and words, never color alone. */
export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  const t = useTranslations('goals.status');
  const { icon: Icon, variant } = STYLE[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {t(status)}
    </Badge>
  );
}
