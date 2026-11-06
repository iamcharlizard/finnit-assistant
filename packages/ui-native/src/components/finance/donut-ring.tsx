import Svg, { Circle } from 'react-native-svg';

import { useToken } from '../../theme/theme-root';

/** A ring filled to `percentage` (@finnit/ui's DonutRing). */
function DonutRing({
  percentage,
  size = 140,
  stroke = 12,
  color,
}: {
  percentage: number;
  size?: number;
  stroke?: number;
  /** Ring color (defaults to the theme's tertiary). */
  color?: string;
}) {
  const track = useToken('--track');
  const tertiary = useToken('--tertiary');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percentage));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color ?? tertiary}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * c} ${c}`}
      />
    </Svg>
  );
}

export { DonutRing };
