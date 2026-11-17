/**
 * Data of a stacked bar chart (one bar per period or month, a segment per
 * series), already formatted. The tallest bar is 100%.
 */
export interface StackedBar {
  key: string;
  label: string;
  value: number;
  /** The bar's total, formatted. */
  total: string;
  /** Height against the tallest bar (0–100). */
  percent: number;
  /** In the series' fixed order. */
  segments: { key: string; value: number; amount: string }[];
}

export function stackedBars(
  bars: ReadonlyArray<{
    key: string;
    label: string;
    segments: ReadonlyArray<{ key: string; value: number }>;
  }>,
  money: (n: number) => string,
): StackedBar[] {
  const totals = bars.map((bar) =>
    bar.segments.reduce((sum, s) => sum + Math.max(0, s.value), 0),
  );
  const max = Math.max(0, ...totals);
  return bars.map((bar, i) => ({
    key: bar.key,
    label: bar.label,
    value: totals[i]!,
    total: money(totals[i]!),
    percent: max > 0 ? Math.round((totals[i]! / max) * 100) : 0,
    segments: bar.segments.map((s) => ({
      key: s.key,
      value: Math.max(0, s.value),
      amount: money(Math.max(0, s.value)),
    })),
  }));
}
