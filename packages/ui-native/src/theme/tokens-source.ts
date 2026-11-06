/**
 * Reads the web's design tokens (packages/ui/src/styles/globals.css) and
 * resolves them per palette and color scheme, so the mobile app paints
 * exactly the same colors. Pure: the generator script and the up-to-date
 * test both use it; the app only imports the generated file.
 */
import { APP_THEMES, type AppTheme } from '@finnit/core/theme/app-theme';

export type ColorScheme = 'light' | 'dark';
export type TokenMap = Record<`--${string}`, string>;

/** One soft radial blob of Glass's background, in fractions of the screen. */
export interface BackgroundBlob {
  /** Center, 0–1 from the left / top. */
  cx: number;
  cy: number;
  /** Radii, 0–1 of the screen width / height. */
  rx: number;
  ry: number;
  /** Color at the center (rgb, no alpha) and its opacity. */
  color: string;
  opacity: number;
}

export interface ResolvedTheme {
  /** Every custom property, with var() references resolved. */
  tokens: TokenMap;
  /** Glass's background blobs; empty for the other palettes. */
  blobs: BackgroundBlob[];
}

export type ResolvedThemes = Record<AppTheme, Record<ColorScheme, ResolvedTheme>>;

interface Block {
  selector: string;
  decls: TokenMap;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Top-level `selector { --x: y; }` blocks with custom properties only. */
function parseBlocks(css: string): Block[] {
  const blocks: Block[] = [];
  const source = stripComments(css);
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf('{', i);
    if (open === -1) break;
    const selector = source
      .slice(i, open)
      .trim()
      .split(/;|\n\s*\n/)
      .pop()!
      .trim();
    // Find the matching brace (blocks may nest, e.g. @layer base { body {} }).
    let depth = 1;
    let j = open + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === '{') depth++;
      else if (source[j] === '}') depth--;
      j++;
    }
    const body = source.slice(open + 1, j - 1);
    if (!selector.startsWith('@')) {
      const decls: TokenMap = {};
      for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        decls[match[1] as `--${string}`] = match[2]!.replace(/\s+/g, ' ').trim();
      }
      blocks.push({ selector, decls });
    }
    i = j;
  }
  return blocks;
}

function blockFor(blocks: Block[], selector: string): TokenMap {
  return blocks.find((b) => b.selector === selector)?.decls ?? {};
}

function resolveVars(tokens: TokenMap): TokenMap {
  const resolved: TokenMap = {};
  const resolve = (name: `--${string}`, seen: Set<string>): string => {
    const raw = tokens[name];
    if (raw === undefined) throw new Error(`Unknown token ${name}`);
    if (seen.has(name)) throw new Error(`Circular token ${name}`);
    seen.add(name);
    return raw.replace(/var\((--[\w-]+)\)/g, (_, ref: `--${string}`) =>
      resolve(ref, new Set(seen)),
    );
  };
  for (const name of Object.keys(tokens) as `--${string}`[]) {
    resolved[name] = resolve(name, new Set());
  }
  return resolved;
}

const percent = (value: string) => Number(value.replace('%', '')) / 100;

/**
 * `radial-gradient(50% 55% at 8% 10%, rgba(0, 245, 255, 0.32) 0%, …)` →
 * blobs. Only the shape Glass uses (an ellipse fading to transparent).
 */
export function parseBlobs(image: string): BackgroundBlob[] {
  if (!image || image === 'none') return [];
  const blobs: BackgroundBlob[] = [];
  const re =
    /radial-gradient\(\s*([\d.]+)%\s+([\d.]+)%\s+at\s+([\d.]+)%\s+([\d.]+)%\s*,\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g;
  for (const m of image.matchAll(re)) {
    blobs.push({
      rx: percent(m[1]!),
      ry: percent(m[2]!),
      cx: percent(m[3]!),
      cy: percent(m[4]!),
      color: `rgb(${m[5]}, ${m[6]}, ${m[7]})`,
      opacity: Number(m[8]),
    });
  }
  return blobs;
}

/**
 * Opacities the web applies to theme colors (`bg-income/10`). Native can't
 * mix a runtime color with transparent, so each one is a token of its own:
 * `--income-10`, used as `bg-income-10`.
 */
export const TINT_ALPHAS = [5, 8, 10, 12, 15, 20, 25, 30, 40, 45, 50, 60, 65, 70, 80, 90, 92, 95] as const;

function parseColor(value: string): [number, number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.replace(/./g, (c) => c + c) : hex[1]!;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as [number, number, number, number];
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
  return null;
}

/** The color tokens (hex / rgba values), the ones that get tints. */
export function colorTokenNames(tokens: TokenMap): `--${string}`[] {
  return (Object.keys(tokens) as `--${string}`[]).filter((name) => parseColor(tokens[name]!) !== null);
}

/** The tokens plus every tint (`--income-10`); ThemeRoot provides these. */
export function withTints(tokens: TokenMap): TokenMap {
  const out: TokenMap = { ...tokens };
  for (const name of colorTokenNames(tokens)) {
    const [r, g, b, a] = parseColor(tokens[name]!)!;
    for (const alpha of TINT_ALPHAS) {
      out[`${name}-${alpha}`] = `rgba(${r}, ${g}, ${b}, ${Number(((a * alpha) / 100).toFixed(4))})`;
    }
  }
  return out;
}

/** Tokens React Native can't use as-is; the components read their parsed forms. */
const NON_NATIVE_TOKENS = new Set(['--app-bg-image', '--glass-blur']);

/**
 * The cascade the web applies on <html>: :root, then .dark, then the
 * palette's block for that scheme (`[data-theme='x']:not(.dark)` / `.dark`).
 */
export function resolveThemes(globalsCss: string): ResolvedThemes {
  const blocks = parseBlocks(globalsCss);
  const root = blockFor(blocks, ':root');
  const dark = blockFor(blocks, '.dark');
  const result = {} as ResolvedThemes;
  for (const theme of APP_THEMES) {
    result[theme] = {} as Record<ColorScheme, ResolvedTheme>;
    for (const scheme of ['light', 'dark'] as const) {
      const palette =
        scheme === 'dark'
          ? blockFor(blocks, `[data-theme='${theme}'].dark`)
          : blockFor(blocks, `[data-theme='${theme}']:not(.dark)`);
      const merged = resolveVars({
        ...root,
        ...(scheme === 'dark' ? dark : {}),
        ...palette,
      });
      const tokens: TokenMap = {};
      for (const [name, value] of Object.entries(merged) as [`--${string}`, string][]) {
        if (!NON_NATIVE_TOKENS.has(name)) tokens[name] = value;
      }
      result[theme][scheme] = {
        tokens,
        blobs: parseBlobs(merged['--app-bg-image'] ?? 'none'),
      };
    }
  }
  return result;
}

/** tints.css: a class for every tint token (`bg-income-10` → var(--income-10)). */
export function renderTintsCss(themes: ResolvedThemes): string {
  const lines = colorTokenNames(themes.finnit.light.tokens).flatMap((name) =>
    TINT_ALPHAS.map((alpha) => `  --color-${name.slice(2)}-${alpha}: var(${name}-${alpha});`),
  );
  return `/* Generated by scripts/generate-tokens.ts. Do not edit. */\n/* The web's color/opacity classes (bg-income/10) as tokens: bg-income-10. */\n@theme inline {\n${lines.join('\n')}\n}\n`;
}

/** The generated module's source; the test compares it with the file on disk. */
export function renderTokensModule(themes: ResolvedThemes): string {
  return `// Generated by scripts/generate-tokens.ts from packages/ui/src/styles/globals.css.
// Do not edit: change the web's tokens, then run \`pnpm --filter @finnit/ui-native tokens\`.
import type { ResolvedThemes } from './tokens-source';

export const THEMES: ResolvedThemes = ${JSON.stringify(themes, null, 2)};
`;
}
