import * as React from 'react';
import { useTranslations } from 'use-intl';
import { ListChecks, RefreshCw, Sparkles } from 'lucide-react-native';

import { requestErrorMessage } from '@finnit/core/graphql/request';
import { LEVEL_COLOR, type RecurringAnalytics as Analytics } from '@finnit/core/recurring/analytics';
import { classifyEssentials, type EssentialAnswers } from '@finnit/core/recurring/essentials';
import { TwView } from '@finnit/ui-native/lib/tw';
import { useColor } from '@finnit/ui-native/theme/theme-root';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Card } from '@finnit/ui-native/components/ui/card';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { DonutChart } from '@/components/charts/donut-chart';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { EssentialsQuestionnaireSheet } from './essentials-questionnaire-sheet';

const tabular = { fontVariant: ['tabular-nums' as const] };
const LEVEL_BADGE = { essential: 'success', reducible: 'muted', dispensable: 'expense' } as const;

/**
 * "Análisis" of Pagos recurrentes (the web's RecurringAnalytics): monthly
 * fixed spending by category and kind, and what the AI judged essential,
 * reducible or dispensable from the questionnaire.
 */
export function RecurringAnalytics({ analytics, answers, onChanged }: { analytics: Analytics; answers: EssentialAnswers | null; onChanged: () => void }) {
  const t = useTranslations('recurring.analytics');
  const l = useLocalizer();
  const gql = useGql();
  const color = useColor();
  const [asking, setAsking] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const { essentials } = analytics;

  async function analyze(onlyMissing: boolean) {
    setRunning(true);
    try {
      const run = await classifyEssentials(onlyMissing, gql);
      if (run.aiUnavailable) toast.error(t('aiUnavailable'));
      else toast.success(t('analyzed', { count: run.classified }));
      onChanged();
    } catch (error) {
      toast.error(requestErrorMessage(error, l.t));
    } finally {
      setRunning(false);
    }
  }

  if (analytics.count === 0) return <EmptyState icon={ListChecks} title={t('empty')} />;

  return (
    <TwView className="gap-4">
      <Card className="gap-1 rounded-[20px] p-[18px]">
        <Text weight="medium" className="text-[11px] uppercase tracking-[0.15em] text-on-surface-variant">
          {t('monthly')}
        </Text>
        <Text weight="bold" className="text-2xl" style={tabular}>
          {analytics.monthly}
        </Text>
        <Text className="text-xs text-on-surface-variant">{t('count', { count: analytics.count })}</Text>
      </Card>
      <DonutChart
        title={t('byCategory')}
        slices={analytics.byCategory}
        centerValue={analytics.monthly}
        centerLabel={t('monthly')}
        countLabel={(count) => t('count', { count })}
        emptyLabel={t('empty')}
      />
      <DonutChart
        title={t('byKind')}
        slices={analytics.byKind}
        centerValue={analytics.monthly}
        centerLabel={t('monthly')}
        countLabel={(count) => t('count', { count })}
        emptyLabel={t('empty')}
      />

      <TwView className="gap-4 rounded-[20px] bg-surface p-[18px]">
        <TwView className="flex-row items-center gap-2">
          <Icon icon={Sparkles} size={16} color="--brand-ink" />
          <Text accessibilityRole="header" weight="bold" className="flex-1 text-base">
            {t('essentialsTitle')}
          </Text>
        </TwView>
        {answers ? (
          <TwView className="flex-row flex-wrap gap-2">
            <Button variant="outline" size="sm" icon={RefreshCw} label={running ? t('analyzing') : t('analyzeAgain')} disabled={running} onPress={() => void analyze(false)} />
            <Button variant="ghost" size="sm" label={t('redo')} disabled={running} onPress={() => setAsking(true)} />
          </TwView>
        ) : (
          <>
            <Text className="text-sm text-on-surface-variant">{t('essentialsIntro')}</Text>
            <Button label={t('start')} onPress={() => setAsking(true)} />
          </>
        )}

        {answers && essentials.items.length > 0 ? (
          <>
            <TwView
              accessible
              accessibilityLabel={essentials.levels.map((level) => `${level.label}: ${level.amount}`).join(', ')}
              className="h-3 flex-row gap-[2px] overflow-hidden rounded-full bg-track"
            >
              {essentials.levels
                .filter((level) => level.value > 0)
                .map((level) => (
                  <TwView key={level.level} style={{ flexGrow: level.value, flexBasis: 0, backgroundColor: color(LEVEL_COLOR[level.level]) }} />
                ))}
            </TwView>
            <TwView className="gap-2">
              {essentials.levels.map((level) => (
                <TwView key={level.level} className="flex-row items-center gap-2 rounded-input bg-track px-3 py-2">
                  <TwView className="size-2 rounded-full" style={{ backgroundColor: color(LEVEL_COLOR[level.level]) }} />
                  <Text className="flex-1 text-xs text-on-surface-variant">
                    {level.label} · {t('count', { count: level.count })} · {level.percent}%
                  </Text>
                  <Text weight="medium" className="text-sm" style={tabular}>
                    {level.amount}
                  </Text>
                </TwView>
              ))}
            </TwView>
            <Text weight="medium" className="text-sm">
              {essentials.savingsValue > 0 ? t('savings', { amount: essentials.savings }) : t('noSavings')}
            </Text>
          </>
        ) : null}
        {answers && essentials.pending > 0 ? (
          <TwView className="flex-row flex-wrap items-center gap-3">
            <Text className="text-sm text-on-surface-variant">{t('pending', { count: essentials.pending })}</Text>
            <Button variant="outline" size="sm" label={running ? t('analyzing') : t('analyzePending')} disabled={running} onPress={() => void analyze(true)} />
          </TwView>
        ) : null}
        {answers && essentials.items.length > 0 ? (
          <TwView className="gap-1">
            <Text weight="bold" className="text-sm">
              {t('listTitle')}
            </Text>
            {essentials.items.map((item) => (
              <TwView key={item.id} className="flex-row items-center gap-3 border-b border-outline py-2.5">
                <TwView className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm">
                    {item.name}
                  </Text>
                  {item.reason ? <Text className="text-xs text-on-surface-variant">{item.reason}</Text> : null}
                </TwView>
                <TwView className="items-end gap-1">
                  <Text weight="medium" className="text-sm" style={tabular}>
                    {item.amount}
                  </Text>
                  <Badge variant={LEVEL_BADGE[item.level]} label={item.levelLabel} />
                </TwView>
              </TwView>
            ))}
          </TwView>
        ) : null}
        {analytics.debts.count > 0 ? (
          <Text className="text-xs text-on-surface-variant">{t('debts', { amount: analytics.debts.amount, count: analytics.debts.count })}</Text>
        ) : null}
      </TwView>

      {asking ? (
        <EssentialsQuestionnaireSheet
          initial={answers}
          onClose={() => setAsking(false)}
          onDone={() => {
            setAsking(false);
            onChanged();
          }}
        />
      ) : null}
    </TwView>
  );
}
