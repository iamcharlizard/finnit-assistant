import type { MonthBar } from '@finnit/ui/components/finance/monthly-distribution-chart';

// TODO: replace with GraphQL (reports module).
// Copied from apps/finnit-app/screens/analytics.tsx.

export type PeriodValue = 'semana' | 'mes' | 'año';

export const PERIOD_ITEMS: ReadonlyArray<{
  value: PeriodValue;
  label: string;
}> = [
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'año', label: 'Año' },
];

export const MONTH_BARS: MonthBar[] = [
  { label: 'Ene', heightPercent: 48 },
  { label: 'Feb', heightPercent: 72, highlighted: true },
  { label: 'Mar', heightPercent: 62 },
  { label: 'Abr', heightPercent: 92, highlighted: true },
];
