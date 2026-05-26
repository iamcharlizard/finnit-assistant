// TODO: evaluar si mover a ui/ si resulta ser genérico

import Animated, { FadeInUp } from 'react-native-reanimated';
import { TwView, TwText, TwPressable } from '../../../lib/tw';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

type SymbolName = SymbolViewProps['name'];

interface CategoryChipProps {
  label: string;
  symbolName: SymbolName;
  accentColor: string;
  onPress?: () => void;
  enteringDelay?: number;
}

export function CategoryChip({
  label,
  symbolName,
  accentColor,
  onPress,
  enteringDelay = 0,
}: CategoryChipProps) {
  return (
    <Animated.View entering={FadeInUp.duration(300).delay(enteringDelay)}>
      <TwPressable
        className="items-center gap-3"
        style={{
          // NW-FALLBACK: glassmorphism card
          width: 112,
          paddingVertical: 16,
          paddingHorizontal: 8,
          borderRadius: 16,
          backgroundColor: 'rgba(45, 52, 73, 0.45)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.10)',
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.08)',
        }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <TwView
          className="w-10 h-10 rounded-full items-center justify-center"
          // NW-FALLBACK: 8-digit hex alpha for icon background
          style={{ backgroundColor: `${accentColor}1a` }}
        >
          <SymbolView
            name={symbolName}
            size={20}
            tintColor={accentColor}
            accessibilityLabel=""
          />
        </TwView>
        <TwText
          className="text-[12px] text-center"
          style={{ fontFamily: 'Ubuntu', color: '#a0a0a0' }}
        >
          {label}
        </TwText>
      </TwPressable>
    </Animated.View>
  );
}
