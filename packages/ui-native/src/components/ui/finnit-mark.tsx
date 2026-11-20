import Svg, { Path } from 'react-native-svg';

/**
 * The Finnit mark (assets/images/brand/finnit-mark-*.svg): three faces,
 * lightest first. In dark mode the lit face is the neon cyan.
 */
export const MARK_FACES = [
  'M38.6 97.2L72 39.3L60.9 20L49.7 39.3L54 46.8L31.7 85.4ZM98.6 124L109.7 104.7L76.3 46.8L69.4 58.6L89.1 92.8L94.3 92.8L101.1 104.7L94.3 116.5ZM23.1 124L34.3 104.7L23.1 85.4L12 104.7Z',
  'M52.3 97.2L72 63.1L69.4 58.6L76.3 46.8L90 46.8L94.3 39.3L72 39.3L38.6 97.2ZM45.4 124L49.7 116.5L94.3 116.5L101.1 104.7L34.3 104.7L23.1 124ZM120.9 124L132 104.7L109.7 104.7L98.6 124Z',
  'M72 39.3L94.3 39.3L83.1 20L60.9 20ZM109.7 104.7L132 104.7L120.9 85.4L112.3 85.4L90 46.8L76.3 46.8ZM34.3 104.7L101.1 104.7L94.3 92.8L54.9 92.8L52.3 97.2L38.6 97.2L31.7 85.4L23.1 85.4Z',
] as const;

export const MARK_COLORS = {
  light: ['#9aa0f0', '#6c72cb', '#5b61c2'],
  dark: ['#00f5ff', '#6c72cb', '#5b61c2'],
} as const;

/** The mark's own box in its path coordinates (no margins): 120 × 104. */
const BOX = { x: 12, y: 20, width: 120, height: 104 };
/** Height per unit of width. */
export const MARK_ASPECT = BOX.height / BOX.width;

/** The mark alone, `width` wide (its height follows), in light or dark colors. */
export function FinnitMark({
  width,
  scheme,
}: {
  width: number;
  scheme: 'light' | 'dark';
}) {
  const colors = MARK_COLORS[scheme];
  return (
    <Svg
      width={width}
      height={width * MARK_ASPECT}
      viewBox={`${BOX.x} ${BOX.y} ${BOX.width} ${BOX.height}`}
    >
      {MARK_FACES.map((d, i) => (
        <Path key={i} d={d} fill={colors[i]} />
      ))}
    </Svg>
  );
}
