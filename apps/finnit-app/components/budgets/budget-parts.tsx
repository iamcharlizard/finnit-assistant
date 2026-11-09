import { useTranslations } from 'use-intl';
import {
  Copy,
  Info,
  OctagonAlert,
  PiggyBank,
  Plus,
  Sparkles,
  TriangleAlert,
} from 'lucide-react-native';

import type {
  AlertItem,
  BudgetTotals,
  CapItem,
  SuggestionItem,
} from '@finnit/core/budgets/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

import { TextLink } from '@/components/finance/text-link';
import { CategoryTile } from './category-tile';
import { StatusText } from './status-text';
import { UsageBar } from './usage-bar';

/** The month's whole budget against everything spent. */
export function BudgetOverview({ totals }: { totals: BudgetTotals }) {
  const t = useTranslations('budgets.overview');
  return (
    <TwView className="gap-3 rounded-card border border-outline bg-surface p-5">
      <Text
        weight="bold"
        className="text-xs uppercase tracking-[0.08em] text-on-surface-variant"
      >
        {t('title')}
      </Text>
      <TwView className="flex-row flex-wrap items-baseline gap-x-2">
        <Text
          weight="bold"
          className="text-3xl"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {totals.spent}
        </Text>
        <Text className="text-sm text-on-surface-variant">
          {t('of', { amount: totals.budgeted })}
        </Text>
      </TwView>
      <UsageBar
        percent={totals.percent}
        status={totals.status}
        label={t('barLabel', { percent: totals.percent })}
      />
      <TwView className="flex-row flex-wrap justify-between gap-2">
        <StatusText status={totals.status}>
          {totals.over
            ? t('over', { amount: totals.remaining })
            : t('left', { amount: totals.remaining })}
        </StatusText>
        <Text className="text-xs text-on-surface-variant">
          {t('used', { percent: totals.percent })}
        </Text>
      </TwView>
      <Text className="text-xs text-on-surface-variant">
        {totals.explicitTotal
          ? t('explicitTotal', { amount: totals.capsSum })
          : t('capsTotal')}
      </Text>
    </TwView>
  );
}

/** Caps at 80% or more of their limit, the fullest first. */
export function AlertsList({ alerts }: { alerts: AlertItem[] }) {
  const t = useTranslations('budgets.alerts');
  if (alerts.length === 0) return null;
  return (
    <TwView className="gap-2">
      <Text accessibilityRole="header" weight="bold" className="px-1 text-lg">
        {t('title')}
      </Text>
      {alerts.map((alert) => (
        <TwView
          key={alert.categoryId}
          className={cn(
            'flex-row items-start gap-2 rounded-input border p-3',
            alert.status === 'over'
              ? 'border-expense-30 bg-expense-5'
              : 'border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.05)]',
          )}
        >
          <Icon
            icon={alert.status === 'over' ? OctagonAlert : TriangleAlert}
            size={16}
            color={alert.status === 'over' ? '--expense' : '--highlight'}
          />
          <Text className="flex-1 text-sm">{alert.text}</Text>
        </TwView>
      ))}
    </TwView>
  );
}

/** Spending no cap counts: without a category and in categories without a cap. */
export function OutsideCapsNote({
  uncategorized,
  uncapped,
}: {
  uncategorized: string | null;
  uncapped: string | null;
}) {
  const t = useTranslations('budgets.outside');
  if (!uncategorized && !uncapped) return null;
  return (
    <TwView className="flex-row items-start gap-3 rounded-input bg-track-60 p-4">
      <Icon icon={Info} size={16} color="--on-surface-variant" />
      <TwView className="flex-1 gap-1">
        <Text weight="medium" className="text-sm">
          {t('title')}
        </Text>
        {uncategorized ? (
          <TwView>
            <Text className="text-sm text-on-surface-variant">
              {t('uncategorized', { amount: uncategorized })}
            </Text>
            <TextLink href="/history?review=1" label={t('categorize')} />
          </TwView>
        ) : null}
        {uncapped ? (
          <Text className="text-sm text-on-surface-variant">
            {t('uncapped', { amount: uncapped })}
          </Text>
        ) : null}
      </TwView>
    </TwView>
  );
}

/** One category cap: spent of the cap, a bar and what is left. */
export function CapListItem({ item }: { item: CapItem }) {
  const t = useTranslations('budgets.caps');
  return (
    <TwView className="flex-row items-start gap-3 rounded-card border border-outline bg-surface p-4">
      <CategoryTile iconKey={item.iconKey} color={item.color} />
      <TwView className="min-w-0 flex-1 gap-2">
        <TwView className="flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <TwView className="min-w-0 shrink">
            <Text weight="bold" numberOfLines={1} className="text-sm">
              {item.name}
            </Text>
            {item.parentName ? (
              <Text className="text-xs text-on-surface-variant">
                {item.parentName}
              </Text>
            ) : null}
          </TwView>
          <Text className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
            {t('spentOf', { spent: item.spent, cap: item.budgeted })}
          </Text>
        </TwView>
        <UsageBar
          percent={item.percent}
          status={item.status}
          label={t('barLabel', { category: item.name, percent: item.percent })}
        />
        <TwView className="flex-row justify-between gap-2">
          <StatusText status={item.status}>
            {item.over
              ? t('over', { amount: item.remaining })
              : item.status === 'over'
                ? t('reached')
                : t('left', { amount: item.remaining })}
          </StatusText>
          <Text className="text-xs text-on-surface-variant">
            {item.percent}%
          </Text>
        </TwView>
      </TwView>
    </TwView>
  );
}

/** A month without a budget: create one, or copy an earlier month's. */
export function NoBudget({
  monthLabel,
  templateLabel,
  busy,
  onCreate,
  onCopy,
}: {
  monthLabel: string;
  templateLabel: string | null;
  busy: boolean;
  onCreate: () => void;
  onCopy: () => void;
}) {
  const t = useTranslations('budgets.empty');
  return (
    <TwView className="items-center gap-3 rounded-card border border-dashed border-on-background-12 px-6 py-10">
      <Icon icon={PiggyBank} size={40} color="--on-surface-variant-50" />
      <Text weight="medium" className="text-center text-base">
        {t('title', { month: monthLabel })}
      </Text>
      <Text className="text-center text-sm text-on-surface-variant">
        {t('description')}
      </Text>
      <TwView className="mt-2 flex-row flex-wrap justify-center gap-2">
        <Button
          variant="secondary"
          icon={Plus}
          label={t('create')}
          onPress={onCreate}
          disabled={busy}
        />
        {templateLabel ? (
          <Button
            variant="outline"
            icon={Copy}
            label={t('copy', { month: templateLabel })}
            onPress={onCopy}
            disabled={busy}
          />
        ) : null}
      </TwView>
    </TwView>
  );
}

/** Caps suggested from the last months' average spending. */
export function SuggestionsCard({
  suggestions,
  total,
  months,
  busy,
  onUse,
}: {
  suggestions: SuggestionItem[];
  total: string;
  months: number;
  busy: boolean;
  onUse: () => void;
}) {
  const t = useTranslations('budgets.suggestions');
  if (suggestions.length === 0) return null;
  return (
    <TwView className="gap-4 rounded-card border border-outline bg-surface p-5">
      <TwView className="flex-row items-start gap-3">
        <Icon icon={Sparkles} size={20} color="--violet-ink" />
        <TwView className="flex-1 gap-0.5">
          <Text accessibilityRole="header" weight="bold" className="text-base">
            {t('title')}
          </Text>
          <Text className="text-sm text-on-surface-variant">
            {t('description', { count: months })}
          </Text>
        </TwView>
      </TwView>
      <TwView>
        {suggestions.map((s, index) => (
          <TwView
            key={s.categoryId}
            className={cn(
              'flex-row items-center gap-3 py-2.5',
              index > 0 && 'border-t border-outline',
            )}
          >
            <CategoryTile iconKey={s.iconKey} color={s.color} size={36} />
            <TwView className="min-w-0 flex-1">
              <Text weight="medium" numberOfLines={1} className="text-sm">
                {s.name}
              </Text>
              <Text className="text-xs text-on-surface-variant">
                {t('average', { amount: s.averageLabel })}
              </Text>
            </TwView>
            <Text
              weight="bold"
              className="text-sm"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {s.capLabel}
            </Text>
          </TwView>
        ))}
      </TwView>
      <TwView className="flex-row flex-wrap items-center justify-between gap-3 border-t border-outline pt-3">
        <Text className="text-sm text-on-surface-variant">
          {t('total', { amount: total })}
        </Text>
        <Button
          variant="secondary"
          label={t('use')}
          onPress={onUse}
          disabled={busy}
        />
      </TwView>
    </TwView>
  );
}
