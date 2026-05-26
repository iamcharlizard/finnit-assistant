// TODO: evaluar si mover a ui/ si resulta ser genérico
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { TwView, TwText } from '../../../lib/tw';

interface MonthBar {
  label: string;
  heightPercent: number;
  highlighted?: boolean;
}

interface MonthlyDistributionChartProps {
  title?: string;
  bars?: MonthBar[];
}

const DEFAULT_BARS: MonthBar[] = [
  { label: 'Ene', heightPercent: 48 },
  { label: 'Feb', heightPercent: 72, highlighted: true },
  { label: 'Mar', heightPercent: 62 },
  { label: 'Abr', heightPercent: 92, highlighted: true },
];

export function MonthlyDistributionChart({
  title = 'Distribución Mensual',
  bars = DEFAULT_BARS,
}: MonthlyDistributionChartProps) {
  const BAR_CONTAINER_HEIGHT = 160;

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(300)}>
      <TwView
        style={{
          // NW-FALLBACK: glassmorphism dark card
          backgroundColor: 'rgba(23, 24, 31, 0.85)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <TwText
          style={{
            fontFamily: 'Ubuntu Medium',
            fontSize: 15,
            color: 'rgba(199, 197, 211, 0.8)',
            marginBottom: 16,
          }}
        >
          {title}
        </TwText>

        {/* Bars container */}
        <TwView
          className="flex-row items-end justify-between"
          style={{ height: BAR_CONTAINER_HEIGHT, paddingHorizontal: 4 }}
          accessibilityRole="none"
          accessibilityLabel="Gráfico de barras de distribución mensual"
          accessibilityElementsHidden
        >
          {bars.map((bar) => (
            <TwView key={bar.label} className="flex-1 items-center" style={{ gap: 6 }}>
              {/* Bar background (track) */}
              <View
                style={{
                  width: '60%',
                  height: BAR_CONTAINER_HEIGHT - 20,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  justifyContent: 'flex-end',
                  overflow: 'hidden',
                }}
              >
                {/* Filled portion */}
                <View
                  style={{
                    width: '100%',
                    height: `${bar.heightPercent}%`,
                    backgroundColor: bar.highlighted
                      ? 'rgba(255, 171, 242, 0.65)'
                      : 'rgba(255, 171, 242, 0.25)',
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                    // NW-FALLBACK: glow on highlighted bars
                    boxShadow: bar.highlighted
                      ? '0 0 10px rgba(255,171,242,0.35)'
                      : undefined,
                  }}
                />
              </View>

              <TwText
                style={{
                  fontFamily: 'Ubuntu',
                  fontSize: 10,
                  color: 'rgba(199, 197, 211, 0.55)',
                }}
              >
                {bar.label}
              </TwText>
            </TwView>
          ))}
        </TwView>
      </TwView>
    </Animated.View>
  );
}
