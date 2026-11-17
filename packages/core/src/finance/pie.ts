/**
 * Donut ("pastel") charts: slices from totals by key, in the chart palette's
 * fixed order (`--chart-1` … `--chart-6`); past six, the smallest fold into
 * "Otros" so no hue is ever generated or reused. And the arcs' SVG paths,
 * shared by the web and the mobile app.
 */

/** The categorical palette, in its validated order. */
export const PIE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
] as const;

export const OTHER_SLICE = 'other';

export interface PieSlice {
  key: string;
  label: string;
  value: number;
  /** Formatted value. */
  amount: string;
  /** Share of the whole, 0–100, rounded. */
  percent: number;
  count: number;
  color: string;
}

/**
 * Largest first; with more than `max` entries the rest become one "Otros"
 * slice (last, with the last color).
 */
export function pieSlices(
  entries: ReadonlyArray<{
    key: string;
    label: string;
    value: number;
    count: number;
  }>,
  {
    money,
    otherLabel,
    max = PIE_COLORS.length,
  }: { money: (n: number) => string; otherLabel: string; max?: number },
): PieSlice[] {
  const list = entries
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);
  const rest = list.slice(max - 1);
  const kept =
    list.length > max
      ? [
          ...list.slice(0, max - 1),
          {
            key: OTHER_SLICE,
            label: otherLabel,
            value: rest.reduce((sum, e) => sum + e.value, 0),
            count: rest.reduce((sum, e) => sum + e.count, 0),
          },
        ]
      : list;
  const total = kept.reduce((sum, e) => sum + e.value, 0);
  return kept.map((e, i) => ({
    key: e.key,
    label: e.label,
    value: e.value,
    amount: money(e.value),
    percent: total > 0 ? Math.round((e.value / total) * 100) : 0,
    count: e.count,
    color: PIE_COLORS[i]!,
  }));
}

/**
 * Each slice's arc as an SVG path of a donut centred on (size/2, size/2),
 * starting at 12 o'clock, clockwise. A lone slice is a full ring.
 */
export function donutPaths(
  values: readonly number[],
  { size, thickness }: { size: number; thickness: number },
): string[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0);
  const c = size / 2;
  const outer = c;
  const inner = c - thickness;
  const point = (r: number, angle: number) =>
    `${(c + r * Math.sin(angle)).toFixed(3)} ${(c - r * Math.cos(angle)).toFixed(3)}`;
  if (total <= 0) return values.map(() => '');
  let start = 0;
  return values.map((v) => {
    const sweep = (Math.max(0, v) / total) * Math.PI * 2;
    const end = start + sweep;
    let d = '';
    if (sweep >= Math.PI * 2 - 1e-6) {
      // Two halves: one arc can't draw a full circle.
      const mid = start + Math.PI;
      d = [
        `M ${point(outer, start)}`,
        `A ${outer} ${outer} 0 1 1 ${point(outer, mid)}`,
        `A ${outer} ${outer} 0 1 1 ${point(outer, start)}`,
        `M ${point(inner, start)}`,
        `A ${inner} ${inner} 0 1 0 ${point(inner, mid)}`,
        `A ${inner} ${inner} 0 1 0 ${point(inner, start)}`,
        'Z',
      ].join(' ');
    } else if (sweep > 0) {
      const large = sweep > Math.PI ? 1 : 0;
      d = [
        `M ${point(outer, start)}`,
        `A ${outer} ${outer} 0 ${large} 1 ${point(outer, end)}`,
        `L ${point(inner, end)}`,
        `A ${inner} ${inner} 0 ${large} 0 ${point(inner, start)}`,
        'Z',
      ].join(' ');
    }
    start = end;
    return d;
  });
}
