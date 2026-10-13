'use client';

import * as React from 'react';
import { Info, RotateCcw } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import { formatMoney } from '@/lib/finance/money';
import { useLocalizer } from '@/lib/i18n/client';
import { compactAmount } from '@/lib/simulator/chart';
import { parseMoneyField, parsePercentField } from '@/lib/simulator/form';
import {
  clampMonths,
  isNeutral,
  neutralScenario,
  simulate,
  type IncomeMode,
  type MonthlyItem,
  type OneTimeItem,
  type Scenario,
} from '@/lib/simulator/scenario';
import {
  describeResult,
  monthAxisLabels,
  projectionMonthLabel,
  type SimulatorData,
} from '@/lib/simulator/view';
import { BalanceChart } from './balance-chart';
import { BalanceTable } from './balance-table';
import { BaselineCard } from './baseline-card';
import { ExtraDebtControl } from './extra-debt-control';
import { IncomeControl } from './income-control';
import { MonthlyItemsControl } from './monthly-items-control';
import { MonthsControl } from './months-control';
import { OneTimeControl } from './one-time-control';
import { ResultStats } from './result-stats';

interface Controls {
  incomeMode: IncomeMode;
  incomeAmountText: string;
  incomePercentText: string;
  extraDebtText: string;
  monthly: MonthlyItem[];
  oneTime: OneTimeItem[];
  months: number;
}

function initialControls(data: SimulatorData): Controls {
  const neutral = neutralScenario(data.baseline);
  return {
    incomeMode: neutral.incomeMode,
    incomeAmountText: String(neutral.incomeAmount),
    incomePercentText: '',
    extraDebtText: '',
    monthly: [],
    oneTime: [],
    months: neutral.months,
  };
}

/**
 * "Simulador ¿Y si…?": the user's real starting point ("Hoy") against a
 * scenario built with the controls, month by month. Nothing is saved.
 */
export function SimulatorScreen({ data }: { data: SimulatorData }) {
  const l = useLocalizer();
  const { t, locale } = l;
  const [controls, setControls] = React.useState(() => initialControls(data));
  // The last valid value of each typed field stays in the scenario while
  // the text is invalid.
  const [lastValid, setLastValid] = React.useState(() => ({
    incomeAmount: data.baseline.income,
    incomePercent: 0,
    extraDebt: 0,
  }));

  const income =
    controls.incomeMode === 'amount'
      ? parseMoneyField(controls.incomeAmountText)
      : parsePercentField(controls.incomePercentText);
  const extraDebt = parseMoneyField(controls.extraDebtText, {
    emptyIsZero: true,
  });

  const scenario: Scenario = {
    incomeMode: controls.incomeMode,
    incomeAmount:
      controls.incomeMode === 'amount' && income.ok
        ? income.value
        : lastValid.incomeAmount,
    incomePercent:
      controls.incomeMode === 'percent' && income.ok
        ? income.value
        : lastValid.incomePercent,
    monthly: controls.monthly,
    oneTime: controls.oneTime,
    extraDebtPayment: extraDebt.ok ? extraDebt.value : lastValid.extraDebt,
    months: controls.months,
  };

  const result = simulate(data.baseline, scenario);
  const view = describeResult(result, data, l);
  const money = (amount: number) => formatMoney(amount, data.currency, locale);
  const whole = (amount: number) =>
    formatMoney(amount, data.currency, locale, { wholeUnits: true });
  const labels = monthAxisLabels(data.startMonth, result.months, l);
  const monthTitle = (index: number) =>
    index === 0
      ? t('simulator.chart.today')
      : projectionMonthLabel(data.startMonth, index, locale);

  function patch(next: Partial<Controls>) {
    setControls((current) => ({ ...current, ...next }));
  }

  function setIncomeText(text: string) {
    if (controls.incomeMode === 'amount') {
      patch({ incomeAmountText: text });
      const parsed = parseMoneyField(text);
      if (parsed.ok)
        setLastValid((v) => ({ ...v, incomeAmount: parsed.value }));
    } else {
      patch({ incomePercentText: text });
      const parsed = parsePercentField(text);
      if (parsed.ok)
        setLastValid((v) => ({ ...v, incomePercent: parsed.value }));
    }
  }

  function setExtraDebtText(text: string) {
    patch({ extraDebtText: text });
    const parsed = parseMoneyField(text, { emptyIsZero: true });
    if (parsed.ok) setLastValid((v) => ({ ...v, extraDebt: parsed.value }));
  }

  function reset() {
    setControls(initialControls(data));
    setLastValid({
      incomeAmount: data.baseline.income,
      incomePercent: 0,
      extraDebt: 0,
    });
  }

  const neutral = isNeutral(data.baseline, scenario);
  const incomeError = income.ok
    ? undefined
    : t(`simulator.validation.${income.error}`);
  const extraDebtError = extraDebt.ok
    ? undefined
    : t(`simulator.validation.${extraDebt.error}`);

  const rows = result.baseline.map((value, i) => ({
    key: i,
    month: monthTitle(i),
    baseline: money(value),
    scenario: money(result.scenario[i]!),
    difference: formatMoney(
      result.scenario[i]! - value,
      data.currency,
      locale,
      {
        sign: 'always',
      },
    ),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] leading-9 font-bold text-brand-ink sm:text-[32px] sm:leading-10">
            {t('simulator.title')}
          </h1>
          <p className="text-[15px] text-on-surface-variant">
            {t('simulator.subtitle')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={reset}
          disabled={neutral}
        >
          <RotateCcw aria-hidden /> {t('simulator.reset')}
        </Button>
      </header>

      <BaselineCard
        balance={money(data.baseline.balance)}
        income={money(data.baseline.income)}
        expenses={money(data.baseline.expenses)}
        net={formatMoney(result.baselineNet, data.currency, locale, {
          sign: 'always',
        })}
        monthsOfData={data.monthsOfData}
        hasData={data.hasData}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <MonthsControl
            months={controls.months}
            onChange={(months) => patch({ months: clampMonths(months) })}
          />
          <IncomeControl
            mode={controls.incomeMode}
            amountText={controls.incomeAmountText}
            percentText={controls.incomePercentText}
            error={incomeError}
            result={money(result.scenarioIncome)}
            onModeChange={(incomeMode) => patch({ incomeMode })}
            onAmountChange={setIncomeText}
            onPercentChange={setIncomeText}
          />
          <MonthlyItemsControl
            items={controls.monthly}
            formatAmount={money}
            onAdd={(item) => patch({ monthly: [...controls.monthly, item] })}
            onRemove={(id) =>
              patch({ monthly: controls.monthly.filter((i) => i.id !== id) })
            }
          />
          <OneTimeControl
            items={controls.oneTime}
            months={result.months}
            monthLabel={(month) =>
              projectionMonthLabel(data.startMonth, month, locale)
            }
            formatAmount={money}
            onAdd={(item) => patch({ oneTime: [...controls.oneTime, item] })}
            onRemove={(id) =>
              patch({ oneTime: controls.oneTime.filter((i) => i.id !== id) })
            }
          />
          <ExtraDebtControl
            text={controls.extraDebtText}
            error={extraDebtError}
            onChange={setExtraDebtText}
          />
        </div>

        <section
          aria-labelledby="simulator-results"
          className="order-first flex min-w-0 flex-col gap-4 lg:order-last lg:self-start"
        >
          <h2 id="simulator-results" className="sr-only">
            {t('simulator.results.title')}
          </h2>
          <ResultStats result={view} />
          <div className="flex flex-col gap-3 rounded-card border border-glass-border bg-glass p-4 backdrop-blur-md">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-on-background">
                {t('simulator.chart.title')}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {t('simulator.chart.net', {
                  baseline: view.baselineNet,
                  scenario: view.scenarioNet,
                })}
              </p>
            </div>
            <BalanceChart
              labels={labels}
              baseline={result.baseline}
              scenario={result.scenario}
              formatValue={money}
              formatAxis={(value) => compactAmount(value, whole)}
              monthTitle={monthTitle}
            />
            <BalanceTable rows={rows} />
          </div>
          <p className="flex gap-2 px-1 text-xs text-on-surface-variant">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {t('simulator.disclaimer')}
          </p>
        </section>
      </div>
    </div>
  );
}
