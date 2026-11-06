/**
 * Geometry of the balance chart: several series over the same months on
 * one y-scale, in a 0–100 box (the SVG stretches it; labels are HTML
 * positioned with the same percentages).
 */
export interface ChartGeometry {
  /** SVG path per series ("M0,40 L10,35 …"). */
  paths: string[];
  /** x of each month, 0–100. */
  xs: number[];
  /** y of each value per series, 0 (top) – 100 (bottom). */
  ys: number[][];
  /** y of the zero line, when zero is inside the range. */
  zeroY: number | null;
  /** Axis values, top to bottom. */
  ticks: { value: number; y: number }[];
}

/** Room above and below the lines, in % of the box. */
const PAD = 6;

export function chartGeometry(series: number[][]): ChartGeometry {
  const values = series.flat();
  const count = Math.max(0, ...series.map((s) => s.length));
  if (values.length === 0 || count === 0) {
    return {
      paths: series.map(() => ''),
      xs: [],
      ys: [],
      zeroY: null,
      ticks: [],
    };
  }
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    // A flat line sits in the middle.
    const spread = Math.abs(min) * 0.1 || 1;
    min -= spread;
    max += spread;
  }
  const span = max - min;
  const yOf = (v: number) =>
    round(PAD + (1 - (v - min) / span) * (100 - 2 * PAD));
  const xs = Array.from({ length: count }, (_, i) =>
    round(count > 1 ? (i / (count - 1)) * 100 : 50),
  );
  const ys = series.map((s) => s.map(yOf));
  const paths = ys.map((points) =>
    points.map((y, i) => `${i === 0 ? 'M' : 'L'}${xs[i]},${y}`).join(' '),
  );
  const middle = (min + max) / 2;
  return {
    paths,
    xs,
    ys,
    zeroY: min < 0 && max > 0 ? yOf(0) : null,
    ticks: [max, middle, min].map((value) => ({ value, y: yOf(value) })),
  };
}

/** The month under a pointer at `fraction` (0–1) of the chart's width. */
export function indexAt(fraction: number, count: number): number {
  if (count <= 1) return 0;
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.round(clamped * (count - 1));
}

/**
 * Which months get an x label: every one when they fit, else evenly
 * spaced ones, always the first and the last.
 */
export function labeledIndexes(count: number, maxLabels: number): number[] {
  if (count <= 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil((count - 1) / (maxLabels - 1));
  const indexes: number[] = [];
  for (let i = 0; i < count - 1; i += step) indexes.push(i);
  // The last label replaces one that would sit too close to it.
  if (count - 1 - indexes.at(-1)! < step / 2) indexes.pop();
  indexes.push(count - 1);
  return indexes;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Short axis amounts without Intl's compact notation (it differs between
 * Node and browsers): "$950", "$12k", "-$1.3M".
 */
export function compactAmount(
  value: number,
  formatWhole: (amount: number) => string,
): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  // The currency symbol as formatMoney writes it ("$", "US$", "MXN ").
  const symbol = formatWhole(1).replace(/1$/, '');
  if (abs >= 1_000_000) {
    const millions = Math.round(abs / 100_000) / 10;
    return `${sign}${symbol}${millions}M`;
  }
  if (abs >= 10_000) return `${sign}${symbol}${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${sign}${symbol}${Math.round(abs / 100) / 10}k`;
  return `${sign}${symbol}${Math.round(abs)}`;
}
