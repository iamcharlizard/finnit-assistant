// TODO: evaluar si mover a ui/ si resulta ser genérico
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { TwView, TwText, TwPressable } from '../../../lib/tw';
import { SymbolView } from 'expo-symbols';

interface NeoTipCardProps {
  title: string;
  body: string;
  highlight?: string; // inline highlighted amount/text
  bodyAfterHighlight?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function NeoTipCard({
  title,
  body,
  highlight,
  bodyAfterHighlight,
  actionLabel = 'Optimizar ahora',
  onActionPress,
}: NeoTipCardProps) {
  const TEAL = '#27dec1';

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(600)}>
      <TwView
        style={{
          // NW-FALLBACK: glassmorphism + teal left border
          backgroundColor: 'rgba(23, 24, 31, 0.85)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          borderLeftWidth: 3,
          borderLeftColor: TEAL,
          borderRadius: 16,
          padding: 20,
          marginBottom: 8,
          overflow: 'hidden',
          // NW-FALLBACK: teal glow
          boxShadow: `0 0 20px rgba(39, 222, 193, 0.18)`,
        }}
      >
        {/* Background watermark icon */}
        <View
          style={{
            position: 'absolute',
            right: -8,
            top: -8,
            opacity: 0.07,
          }}
          pointerEvents="none"
        >
          <SymbolView
            name="lightbulb.fill"
            size={60}
            tintColor={TEAL}
            accessibilityLabel=""
          />
        </View>

        {/* Title row */}
        <TwView className="flex-row items-center gap-2 mb-2">
          <SymbolView
            name="star.fill"
            size={18}
            tintColor={TEAL}
            accessibilityLabel=""
          />
          <TwText
            style={{
              fontFamily: 'Ubuntu Bold',
              fontSize: 15,
              color: TEAL,
              flex: 1,
            }}
          >
            {title}
          </TwText>
        </TwView>

        {/* Body text with optional inline highlight */}
        <TwText
          style={{
            fontFamily: 'Ubuntu',
            fontSize: 13,
            lineHeight: 20,
            color: 'rgba(199, 197, 211, 0.75)',
            marginBottom: 14,
          }}
        >
          {body}
          {highlight ? (
            <TwText
              style={{
                fontFamily: 'Ubuntu Bold',
                color: TEAL,
              }}
            >
              {highlight}
            </TwText>
          ) : null}
          {bodyAfterHighlight ?? ''}
        </TwText>

        {/* Action button */}
        <TwPressable
          style={{
            alignSelf: 'flex-start',
            backgroundColor: 'rgba(39, 222, 193, 0.10)',
            borderWidth: 1,
            borderColor: 'rgba(39, 222, 193, 0.30)',
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
            minHeight: 44,
            justifyContent: 'center',
          }}
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <TwText
            style={{
              fontFamily: 'Ubuntu Medium',
              fontSize: 13,
              color: TEAL,
            }}
          >
            {actionLabel}
          </TwText>
        </TwPressable>
      </TwView>
    </Animated.View>
  );
}
