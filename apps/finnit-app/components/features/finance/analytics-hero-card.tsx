// TODO: evaluar si mover a ui/ si resulta ser genérico
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { TwView, TwText } from '../../../lib/tw';
import { SymbolView } from 'expo-symbols';

interface SparkBar {
  heightPercent: number;
  highlighted?: boolean;
}

interface AnalyticsHeroCardProps {
  label?: string;
  amount: string;
  trendPercent: string;
  trendDown?: boolean;
  sparkBars?: SparkBar[];
}

const DEFAULT_BARS: SparkBar[] = [
  { heightPercent: 40 },
  { heightPercent: 60 },
  { heightPercent: 45 },
  { heightPercent: 70 },
  { heightPercent: 85, highlighted: true },
  { heightPercent: 50 },
  { heightPercent: 30 },
];

export function AnalyticsHeroCard({
  label = 'Gasto Total',
  amount,
  trendPercent,
  trendDown = true,
  sparkBars = DEFAULT_BARS,
}: AnalyticsHeroCardProps) {
  return (
    <Animated.View entering={FadeInUp.duration(400).delay(100)}>
      <TwView
        style={{
          // NW-FALLBACK: glassmorphism dark card
          backgroundColor: 'rgba(23, 24, 31, 0.85)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow top-right */}
        <View
          style={{
            position: 'absolute',
            top: -32,
            right: -32,
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: 'rgba(108, 114, 203, 0.15)',
          }}
          pointerEvents="none"
        />

        {/* Header row */}
        <TwView className="flex-row justify-between items-start mb-4">
          <TwView>
            <TwText
              style={{
                fontFamily: 'Ubuntu',
                fontSize: 13,
                color: 'rgba(227, 225, 235, 0.6)',
                marginBottom: 4,
              }}
            >
              {label}
            </TwText>
            <TwText
              style={{
                fontFamily: 'Ubuntu Bold',
                fontSize: 32,
                lineHeight: 40,
                color: '#e3e1eb',
              }}
              accessibilityRole="text"
              accessibilityLabel={`${label}: ${amount}`}
            >
              {amount}
            </TwText>
          </TwView>

          {/* Trend badge */}
          <TwView
            className="flex-row items-center gap-1 px-2 py-1 rounded-lg"
            style={{ backgroundColor: 'rgba(39, 222, 193, 0.12)' }}
            accessibilityLabel={`Tendencia: ${trendDown ? 'bajó' : 'subió'} ${trendPercent}`}
          >
            <SymbolView
              name={trendDown ? 'arrow.down.right' : 'arrow.up.right'}
              size={12}
              tintColor="#27dec1"
              accessibilityLabel=""
            />
            <TwText
              style={{
                fontFamily: 'Ubuntu Bold',
                fontSize: 13,
                color: '#27dec1',
              }}
            >
              {trendPercent}
            </TwText>
          </TwView>
        </TwView>

        {/* Sparkline bars */}
        <TwView
          className="flex-row items-end gap-1"
          style={{ height: 64 }}
          accessibilityElementsHidden
        >
          {sparkBars.map((bar, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: `${bar.heightPercent}%`,
                backgroundColor: bar.highlighted
                  ? 'rgba(108, 114, 203, 0.55)'
                  : 'rgba(108, 114, 203, 0.22)',
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                // NW-FALLBACK: conditional boxShadow for highlighted bar
                boxShadow: bar.highlighted
                  ? '0 0 8px rgba(191, 194, 255, 0.35)'
                  : undefined,
              }}
            />
          ))}
        </TwView>
      </TwView>
    </Animated.View>
  );
}
