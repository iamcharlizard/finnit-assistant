import { useTranslations } from 'use-intl';
import { CalendarDays, ChevronRight, Gauge, PiggyBank, Plus, Sparkles, Target } from 'lucide-react-native';
import { useWindowDimensions, ScrollView } from 'react-native';

import type { GoalStatus } from '@finnit/core/goals/status';
import type { GoalCardView, GoalsSummary as Summary } from '@finnit/core/goals/view';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { useToken } from '@finnit/ui-native/theme/theme-root';
import { DonutRing } from '@finnit/ui-native/components/finance/donut-ring';
import { Badge, type BadgeVariant } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

import { SummaryCard } from '@/components/recurring/summary-card';

const VARIANT: Record<GoalStatus, BadgeVariant> = {
  reached: 'success',
  onTrack: 'income',
  behind: 'highlight',
  overdue: 'expense',
  noDueDate: 'muted',
};

/** "En camino", "Atrasada", "Alcanzada"… */
export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  const t = useTranslations('goals.status');
  return <Badge variant={VARIANT[status]} label={t(status)} />;
}

/** The goal's progress as a ring with the percentage in the middle. */
export function ProgressRing({ percent, reached, size = 72, label }: { percent: number; reached: boolean; size?: number; label: string }) {
  const tertiary = useToken('--tertiary');
  return (
    <TwView accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: size, height: size }} className="shrink-0">
      <DonutRing percentage={percent} size={size} stroke={Math.max(6, Math.round(size / 10))} color={reached ? '#22c55e' : tertiary} />
      <TwView className="absolute inset-0 items-center justify-center">
        <Text weight="bold" className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
          {percent}%
        </Text>
      </TwView>
    </TwView>
  );
}

/** One goal: progress, deadline, projection and status. Opens the detail. */
export function GoalCard({ card, onOpen }: { card: GoalCardView; onOpen: () => void }) {
  const t = useTranslations('goals.card');
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityLabel={t('open', { name: card.name })}
      onPress={onOpen}
      className="gap-4 rounded-card border border-glass-border bg-glass p-4 active:bg-accent"
    >
      <TwView className="flex-row items-start justify-between gap-3">
        <TwView className="min-w-0 flex-1 gap-1.5">
          <Text accessibilityRole="header" weight="bold" numberOfLines={1} className="text-base">
            {card.name}
          </Text>
          <GoalStatusBadge status={card.status} />
        </TwView>
        <Icon icon={ChevronRight} size={16} color="--on-surface-variant" />
      </TwView>
      <TwView className="flex-row items-center gap-4">
        <ProgressRing percent={card.percent} reached={card.status === 'reached'} label={t('progressLabel', { percent: card.percent })} />
        <TwView className="min-w-0 flex-1">
          <Text weight="bold" numberOfLines={1} className="text-xl" style={{ fontVariant: ['tabular-nums'] }}>
            {card.saved}
          </Text>
          <Text numberOfLines={1} className="text-xs text-on-surface-variant">
            {t('of', { target: card.target })}
          </Text>
          {card.status !== 'reached' ? (
            <Text numberOfLines={1} className="text-xs text-on-surface-variant">
              {t('remaining', { amount: card.remaining })}
            </Text>
          ) : null}
        </TwView>
      </TwView>
      <TwView className="gap-1.5 border-t border-outline-60 pt-3">
        <TwView className="flex-row items-center gap-2">
          <Icon icon={CalendarDays} size={14} color="--on-surface-variant" />
          <Text numberOfLines={1} className="flex-1 text-xs text-on-surface-variant">
            {card.dueLabel}
            {card.daysLabel ? <Text weight="medium" className="text-xs">{` · ${card.daysLabel}`}</Text> : null}
          </Text>
        </TwView>
        <Text className="text-xs text-on-surface-variant">{card.projectionLabel}</Text>
      </TwView>
    </TwPressable>
  );
}

/** Totals across goals (scrolling cards on phones). */
export function GoalsSummary({ summary }: { summary: Summary }) {
  const t = useTranslations('goals.summary');
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.72);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} snapToInterval={cardWidth + 12} decelerationRate="fast">
      <SummaryCard width={cardWidth} icon={PiggyBank} accent="#00a86b" label={t('saved')} amount={summary.saved} detail={t('savedDetail', { target: summary.target, count: summary.count })} />
      <SummaryCard width={cardWidth} icon={Gauge} accent="#00696e" label={t('average')} amount={summary.averageProgress} detail={t('averageDetail')} />
      <SummaryCard width={cardWidth} icon={Sparkles} accent="#6c72cb" label={t('recommended')} amount={summary.recommendedMonthly} detail={t('recommendedDetail')} />
    </ScrollView>
  );
}

/** No goals yet: what they are for and a button to create the first one. */
export function GoalsEmpty({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations('goals.empty');
  return (
    <TwView className="items-center gap-3 rounded-card border border-dashed border-outline px-6 py-12">
      <TwView className="size-12 items-center justify-center rounded-full bg-accent-neon-20">
        <Icon icon={Target} size={24} color="--brand-ink" />
      </TwView>
      <Text weight="bold" className="text-center text-lg">
        {t('title')}
      </Text>
      <Text className="text-center text-sm text-on-surface-variant">{t('description')}</Text>
      <Button variant="secondary" icon={Plus} label={t('cta')} onPress={onCreate} />
    </TwView>
  );
}
