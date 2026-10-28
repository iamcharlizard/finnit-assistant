/**
 * Color helpers based on WCAG 2.x relative luminance and contrast ratio.
 * Pure functions (no DOM, no Intl) so they are safe in SSR.
 */

/** Text colors `readableTextColor` chooses between. */
const LIGHT_TEXT = '#FFFFFF';
/** Near-black matching the dark `--brand-foreground` / `--primary-foreground` token. */
const DARK_TEXT = '#0B0C1A';

type ReadableTextColor = typeof LIGHT_TEXT | typeof DARK_TEXT;

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** True for `#RGB` or `#RRGGBB` (leading `#` optional). */
function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

/** Normalizes `#abc`, `abc`, `#AABBCC` to uppercase `#AABBCC`. Throws on invalid input. */
function normalizeHex(value: string): string {
  const match = HEX_PATTERN.exec(value.trim());
  if (!match?.[1]) throw new Error(`Invalid hex color: "${value}"`);
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return `#${hex.toUpperCase()}`;
}

function hexToRgb(value: string): [number, number, number] {
  const hex = normalizeHex(value).slice(1);
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance (0 = black, 1 = white). */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors (1 to 21). */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Picks white or near-black text for a background.
 *
 * - Single color: the candidate with the higher contrast.
 * - Gradient `[stop1, stop2]`: the candidate that reaches 4.5:1 (WCAG AA) against
 *   BOTH stops; if both or neither do, the one with the best worst-case contrast.
 */
function readableTextColor(
  background: string | readonly [string, string],
): ReadableTextColor {
  const stops = typeof background === 'string' ? [background] : background;
  const minContrast = (text: string) =>
    Math.min(...stops.map((stop) => contrastRatio(text, stop)));

  const light = minContrast(LIGHT_TEXT);
  const dark = minContrast(DARK_TEXT);
  const AA = 4.5;

  if (light >= AA && dark < AA) return LIGHT_TEXT;
  if (dark >= AA && light < AA) return DARK_TEXT;
  return light > dark ? LIGHT_TEXT : DARK_TEXT;
}

export {
  DARK_TEXT,
  LIGHT_TEXT,
  contrastRatio,
  isHexColor,
  normalizeHex,
  readableTextColor,
  relativeLuminance,
  type ReadableTextColor,
};
