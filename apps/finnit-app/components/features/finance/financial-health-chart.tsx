// TODO: evaluar si mover a ui/ si resulta ser genérico
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { TwView, TwText } from '../../../lib/tw';

interface DonutRingProps {
  percentage: number; // 0-100
  size?: number;
  strokeWidth?: number;
  fillColor?: string;
  trackColor?: string;
}

// Double-half-circle donut without react-native-svg.
// Technique: two semi-circle containers, each with a bordered circle inside.
// - Right container (0°-180°): full colored ring
// - Left container (180°-360°): right+bottom colored ring, rotated to show only the desired arc
function DonutRing({
  percentage,
  size = 140,
  strokeWidth = 12,
  fillColor = '#27dec1',
  trackColor = 'rgba(255,255,255,0.06)',
}: DonutRingProps) {
  const half = size / 2;

  // For percentage > 50 we need both halves.
  // Right half always shows 0-180° (50%). Left half shows the remainder.
  // The left half container exposes 180-360°. To restrict it to 180-(180+extraDeg):
  //   use borderRightColor+borderBottomColor colored, rotated by (extraDeg - 90) deg.
  const extraDeg = Math.max(0, (percentage - 50) / 50) * 180; // 0-180

  // Rotation so that colored arc 45°-225° shifted by R covers 180° to (180+extraDeg):
  // Specifically: right+bottom (45°-225°) rotated R → (45+R)-(225+R) visible.
  // Left clip sees 180-360. Intersection start = max(45+R, 180) = 180 → R = 135-off.
  // Intersection end = 180+extraDeg → 225+R = 180+extraDeg → R = extraDeg-45.
  // For extraDeg=90 (total 75%): R=45°. This is the clean derivation.
  const leftRotation = extraDeg - 45;

  const rightFill = percentage > 0 ? fillColor : 'transparent';
  const leftFill = percentage > 50 ? fillColor : 'transparent';

  return (
    <View style={{ width: size, height: size }}>
      {/* Track ring */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: strokeWidth,
          borderColor: trackColor,
        }}
      />

      {/* Right half: shows 0°-180° (starting from top, clockwise) */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          width: half,
          height: size,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            right: 0,
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: rightFill,
          }}
        />
      </View>

      {/* Left half: shows the extra arc beyond 180° */}
      {percentage > 50 && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            width: half,
            height: size,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: 0,
              width: size,
              height: size,
              borderRadius: half,
              borderWidth: strokeWidth,
              borderTopColor: 'transparent',
              borderRightColor: leftFill,
              borderBottomColor: leftFill,
              borderLeftColor: 'transparent',
              transform: [{ rotate: `${leftRotation}deg` }],
            }}
          />
        </View>
      )}
    </View>
  );
}

interface FinancialHealthChartProps {
  percentage?: number;
  label?: string;
  rating?: string;
  caption?: string;
}

export function FinancialHealthChart({
  percentage = 75,
  label = 'Salud Financiera',
  rating = 'Excelente',
  caption = 'Tu ratio de ahorro ha subido un 5% respecto al mes pasado.',
}: FinancialHealthChartProps) {
  return (
    <Animated.View entering={FadeInUp.duration(400).delay(200)}>
      <TwView
        style={{
          // NW-FALLBACK: glassmorphism dark card
          backgroundColor: 'rgba(23, 24, 31, 0.85)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <TwText
          style={{
            fontFamily: 'Ubuntu Medium',
            fontSize: 15,
            color: 'rgba(199, 197, 211, 0.8)',
            alignSelf: 'flex-start',
            marginBottom: 20,
          }}
        >
          {label}
        </TwText>

        {/* Donut chart with centered label */}
        <View
          style={{ width: 140, height: 140, marginBottom: 16 }}
          accessibilityRole="progressbar"
          accessibilityLabel={`Salud financiera: ${percentage}%`}
          accessibilityValue={{ min: 0, max: 100, now: percentage }}
        >
          <DonutRing percentage={percentage} />

          {/* Center labels */}
          <TwView
            style={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            pointerEvents="none"
          >
            <TwText
              style={{
                fontFamily: 'Ubuntu Bold',
                fontSize: 26,
                lineHeight: 32,
                color: '#e3e1eb',
              }}
            >
              {percentage}%
            </TwText>
            <TwText
              style={{
                fontFamily: 'Ubuntu',
                fontSize: 12,
                color: '#27dec1',
                marginTop: 2,
              }}
            >
              {rating}
            </TwText>
          </TwView>
        </View>

        <TwText
          style={{
            fontFamily: 'Ubuntu',
            fontSize: 13,
            lineHeight: 20,
            color: 'rgba(199, 197, 211, 0.7)',
            textAlign: 'center',
            paddingHorizontal: 8,
          }}
        >
          {caption}
        </TwText>
      </TwView>
    </Animated.View>
  );
}
