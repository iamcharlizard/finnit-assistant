// TODO: evaluar si mover a ui/ si resulta ser genérico
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { TwView, TwText, TwPressable } from '../../../lib/tw';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

type SymbolName = SymbolViewProps['name'];

interface CategoryProgressItemProps {
  label: string;
  amount: string;
  progressPercent: number; // 0-100
  symbolName: SymbolName;
  iconBg: string;
  iconTint: string;
  barColor: string;
  index?: number;
  onPress?: () => void;
}

export function CategoryProgressItem({
  label,
  amount,
  progressPercent,
  symbolName,
  iconBg,
  iconTint,
  barColor,
  index = 0,
  onPress,
}: CategoryProgressItemProps) {
  return (
    <Animated.View entering={FadeInUp.duration(350).delay(400 + index * 60)}>
      <TwPressable
        className="flex-row items-center gap-4 rounded-[16px] p-4 mb-2"
        style={{
          // NW-FALLBACK: glassmorphism dark card
          backgroundColor: 'rgba(23, 24, 31, 0.85)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          minHeight: 44,
        }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${amount}`}
      >
        {/* Icon */}
        <TwView
          className="items-center justify-center rounded-full"
          style={{
            width: 48,
            height: 48,
            backgroundColor: iconBg,
            borderWidth: 1,
            borderColor: `${iconTint}33`,
          }}
        >
          <SymbolView
            name={symbolName}
            size={22}
            tintColor={iconTint}
            accessibilityLabel=""
          />
        </TwView>

        {/* Content */}
        <TwView className="flex-1">
          <TwView className="flex-row justify-between mb-2">
            <TwText
              style={{
                fontFamily: 'Ubuntu Medium',
                fontSize: 15,
                color: '#e3e1eb',
              }}
            >
              {label}
            </TwText>
            <TwText
              style={{
                fontFamily: 'Ubuntu Bold',
                fontSize: 15,
                color: '#e3e1eb',
              }}
            >
              {amount}
            </TwText>
          </TwView>

          {/* Progress bar */}
          <View
            style={{
              width: '100%',
              height: 5,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 9999,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                backgroundColor: barColor,
                borderRadius: 9999,
              }}
            />
          </View>
        </TwView>
      </TwPressable>
    </Animated.View>
  );
}
