interface DonutRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  fillColor?: string;
  trackColor?: string;
}

/** SVG donut ring; replaces the mobile two-half-circle View technique. */
function DonutRing({
  percentage,
  size = 140,
  strokeWidth = 12,
  fillColor = 'var(--tertiary)',
  trackColor = 'var(--track)',
}: DonutRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={fillColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export { DonutRing, type DonutRingProps };
