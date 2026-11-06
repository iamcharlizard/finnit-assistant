import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTranslations } from 'use-intl';
import { Info, RotateCcw } from 'lucide-react-native';

import { formatMoney } from '@finnit/core/finance/money';
import { todayKey } from '@finnit/core/finance/dates';
import { parseMoneyField, parsePercentField } from '@finnit/core/simulator/form';
import { clampMonths, isNeutral, neutralScenario, simulate, type IncomeMode, type Scenario } from '@finnit/core/simulator/scenario';
import { SIMULATOR_QUERY, type SimulatorResult } from '@finnit/core/simulator/request';
import { buildSimulatorData, describeResult, type SimulatorData } from '@finnit/core/simulator/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { useToken } from '@finnit/ui-native/theme/theme-root';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { NumberInput } from '@finnit/ui-native/components/ui/number-input';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Text } from '@finnit/ui-native/components/ui/text';

import { Screen } from '@/components/shell/screen';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

const PRESETS = [6, 12, 24, 36] as const;

function linePath(values: number[], width: number, height: number, min: number, max: number) {
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${height - 6 - ((v - min) / span) * (height - 12)}`).join(' ');
}

function BalanceChart({ baseline, scenario }: { baseline: number[]; scenario: number[] }) {
  const [width, setWidth] = React.useState(0);
  const base = useToken('--on-surface-variant');
  const scen = useToken('--chart-1');
  const height = 160;
  const all = [...baseline, ...scenario];
  const min = Math.min(0, ...all);
  const max = Math.max(...all);
  return (
    <TwView importantForAccessibility="no-hide-descendants" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Path d={linePath(baseline, width, height, min, max)} fill="none" stroke={base} strokeWidth={2} strokeDasharray="4 4" />
          <Path d={linePath(scenario, width, height, min, max)} fill="none" stroke={scen} strokeWidth={2.5} />
        </Svg>
      ) : null}
    </TwView>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'up' | 'down' | 'flat' }) {
  return (
    <TwView className="flex-1 gap-1 rounded-2xl border border-glass-border bg-glass p-3" style={{ minWidth: '45%' }}>
      <Text className="text-xs text-on-surface-variant">{label}</Text>
      <Text weight="bold" numberOfLines={1} adjustsFontSizeToFit className={cn('text-lg', tone === 'up' && 'text-income', tone === 'down' && 'text-expense')}>
        {value}
      </Text>
      <Text className="text-[11px] text-on-surface-variant">{note}</Text>
    </TwView>
  );
}

function Simulator({ data }: { data: SimulatorData }) {
  const l = useLocalizer();
  const t = useTranslations('simulator');
  const neutral0 = neutralScenario(data.baseline);
  const [months, setMonths] = React.useState(neutral0.months);
  const [mode, setMode] = React.useState<IncomeMode>(neutral0.incomeMode);
  const [amountText, setAmountText] = React.useState(String(neutral0.incomeAmount));
  const [percentText, setPercentText] = React.useState('');
  const [extraText, setExtraText] = React.useState('');
  const income = mode === 'amount' ? parseMoneyField(amountText) : parsePercentField(percentText);
  const extra = parseMoneyField(extraText, { emptyIsZero: true });
  const scenario: Scenario = {
    ...neutral0,
    incomeMode: mode,
    incomeAmount: mode === 'amount' && income.ok ? income.value : data.baseline.income,
    incomePercent: mode === 'percent' && income.ok ? income.value : 0,
    extraDebtPayment: extra.ok ? extra.value : 0,
    months,
  };
  const result = simulate(data.baseline, scenario);
  const view = describeResult(result, data, l);
  const money = (n: number) => formatMoney(n, data.currency, l.locale);
  const reset = () => {
    setMonths(neutral0.months);
    setMode(neutral0.incomeMode);
    setAmountText(String(neutral0.incomeAmount));
    setPercentText('');
    setExtraText('');
  };

  return (
    <TwView className="gap-5">
      <Card className="gap-3">
        <Text accessibilityRole="header" weight="bold" className="text-sm">
          {t('baseline.title')}
        </Text>
        <Text className="text-xs text-on-surface-variant">{data.hasData ? t('baseline.source', { count: data.monthsOfData }) : t('baseline.noData')}</Text>
        <TwView className="flex-row flex-wrap gap-y-3">
          {[
            [t('baseline.balance'), money(data.baseline.balance)],
            [t('baseline.income'), money(data.baseline.income)],
            [t('baseline.expenses'), money(data.baseline.expenses)],
            [t('baseline.net'), formatMoney(result.baselineNet, data.currency, l.locale, { sign: 'always' })],
          ].map(([label, value]) => (
            <TwView key={label} style={{ width: '50%' }}>
              <Text className="text-xs text-on-surface-variant">{label}</Text>
              <Text weight="bold" className="text-base">
                {value}
              </Text>
            </TwView>
          ))}
        </TwView>
      </Card>

      <TwView className="flex-row flex-wrap gap-3">
        <Stat label={t('results.endScenario')} value={view.endScenario} note={t('results.endNote', { month: view.endMonth })} />
        <Stat label={t('results.endBaseline')} value={view.endBaseline} note={t('results.endNote', { month: view.endMonth })} />
        <Stat label={t('results.difference')} value={view.difference} note={t(`results.differenceNote.${view.tone}`)} tone={view.tone} />
        <Stat label={t('results.negative')} value={view.scenarioNegative} note={t('results.negativeBaseline', { value: view.baselineNegative })} />
      </TwView>

      <Card className="gap-3">
        <Text weight="bold" className="text-sm">
          {t('chart.title')}
        </Text>
        <Text className="text-xs text-on-surface-variant">{t('chart.net', { baseline: view.baselineNet, scenario: view.scenarioNet })}</Text>
        <BalanceChart baseline={result.baseline} scenario={result.scenario} />
      </Card>

      <Card className="gap-3">
        <Text accessibilityRole="header" weight="bold" className="text-sm">
          {t('months.title')}
        </Text>
        <Segmented
          accessibilityLabel={t('months.presets')}
          options={PRESETS.map((p) => ({ value: String(p), label: t('months.value', { count: p }) }))}
          value={String(PRESETS.includes(months as (typeof PRESETS)[number]) ? months : 12)}
          onValueChange={(v) => setMonths(clampMonths(Number(v)))}
        />
      </Card>

      <Card className="gap-3">
        <Text accessibilityRole="header" weight="bold" className="text-sm">
          {t('income.title')}
        </Text>
        <Text className="text-xs text-on-surface-variant">{t('income.description')}</Text>
        <Segmented
          accessibilityLabel={t('income.mode')}
          options={[
            { value: 'percent', label: t('income.percentMode') },
            { value: 'amount', label: t('income.amountMode') },
          ]}
          value={mode}
          onValueChange={(v) => setMode(v as IncomeMode)}
        />
        {mode === 'percent' ? (
          <NumberInput label={t('income.percent')} value={percentText} onValueChange={setPercentText} allowNegative decimals={1} suffix="%" error={income.ok ? undefined : t(`validation.${income.error}`)} />
        ) : (
          <MoneyInput label={t('income.amount')} value={amountText} onValueChange={setAmountText} currency={data.currency} error={income.ok ? undefined : t(`validation.${income.error}`)} />
        )}
        <Text className="px-1 text-xs text-on-surface-variant">
          {mode === 'percent' ? `${t('income.percentHint')} ` : ''}
          {t('income.result', { amount: money(result.scenarioIncome) })}
        </Text>
      </Card>

      <Card className="gap-3">
        <Text accessibilityRole="header" weight="bold" className="text-sm">
          {t('extraDebt.title')}
        </Text>
        <Text className="text-xs text-on-surface-variant">{t('extraDebt.description')}</Text>
        <MoneyInput label={t('extraDebt.amount')} value={extraText} onValueChange={setExtraText} currency={data.currency} error={extra.ok ? undefined : t(`validation.${extra.error}`)} />
        <Text className="px-1 text-xs text-on-surface-variant">{t('extraDebt.note')}</Text>
      </Card>

      <Button variant="outline" icon={RotateCcw} label={t('reset')} disabled={isNeutral(data.baseline, scenario)} onPress={reset} />
      <TwView className="flex-row gap-2 px-1">
        <Icon icon={Info} size={14} color="--on-surface-variant" />
        <Text className="flex-1 text-xs text-on-surface-variant">{t('disclaimer')}</Text>
      </TwView>
    </TwView>
  );
}

/** Simulador ¿Y si…?: the real starting point against a scenario built with the controls. */
export function SimulatorScreen() {
  const t = useTranslations('simulator');
  const today = todayKey();
  const { view, loading, error, refreshing, refresh } = useView({
    query: SIMULATOR_QUERY,
    variables: {},
    build: (data: SimulatorResult) => buildSimulatorData(data.cashFlowBaseline, today),
  });
  return (
    <Screen title={t('title')} subtitle={t('subtitle')} loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      {view ? <Simulator data={view} /> : null}
    </Screen>
  );
}
