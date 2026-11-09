import * as React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { TwView } from '../../lib/tw';

interface SparklineProps {
  /** Oldest first; fewer than two values draw nothing. */
  values: ReadonlyArray<number>;
  /** Resolved color (hex), e.g. from useColor()('var(--chart-1)'). */
  color: string;
  width?: number;
  height?: number;
}

/** Room so the 2px line isn't cut at the top and bottom. */
const PAD = 3;

/**
 * A tiny trend line with a soft area under it (@finnit/ui's Sparkline).
 * Decorative: the figure next to it carries the meaning.
 */
function Sparkline({ values, color, width = 72, height = 36 }: SparklineProps) {
  const id = React.useId().replace(/:/g, '');
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * width;
    const y =
      max === min
        ? height / 2
        : PAD + (1 - (value - min) / span) * (height - PAD * 2);
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <TwView
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill={`url(#${id})`} />
        <Path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TwView>
  );
}

export { Sparkline, type SparklineProps };
