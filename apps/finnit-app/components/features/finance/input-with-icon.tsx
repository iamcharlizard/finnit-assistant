// TODO: evaluar si mover a ui/ si resulta ser genérico

import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { useColorScheme } from 'nativewind';
import type { TextInputProps } from 'react-native';
import { TwView, TwText, TwTextInput, TwPressable } from '../../../lib/tw';

interface InputWithIconProps extends TextInputProps {
  label?: string;
  iconLeft?: SymbolViewProps['name'];
  iconRight?: SymbolViewProps['name'];
  onIconRightPress?: () => void;
  iconRightAccessibilityLabel?: string;
  error?: string;
  accessibilityLabel?: string;
}

export function InputWithIcon({
  label,
  iconLeft,
  iconRight,
  onIconRightPress,
  iconRightAccessibilityLabel,
  error,
  accessibilityLabel,
  ...props
}: InputWithIconProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TwView style={{ gap: 6 }}>
      {label ? (
        <TwText
          style={{
            fontFamily: 'Ubuntu Medium',
            fontSize: 12,
            lineHeight: 16,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: isDark ? '#a0a0a0' : '#5c6370',
          }}
        >
          {label}
        </TwText>
      ) : null}

      <TwView
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isDark ? '#2d2e38' : '#e0e0e0',
          backgroundColor: isDark ? '#1a1b22' : '#ffffff',
          minHeight: 48,
          paddingLeft: iconLeft ? 14 : 16,
        }}
      >
        {iconLeft ? (
          <TwView style={{ marginRight: 10, opacity: 0.6 }}>
            <SymbolView
              name={iconLeft}
              size={18}
              tintColor={isDark ? '#a0a0a0' : '#5c6370'}
              style={{ width: 18, height: 18 }}
            />
          </TwView>
        ) : null}

        <TwTextInput
          style={{
            flex: 1,
            fontFamily: 'Ubuntu',
            fontSize: 16,
            lineHeight: 24,
            color: isDark ? '#f8f9fa' : '#1a1b22',
            paddingVertical: 12,
            paddingRight: iconRight ? 4 : 16,
          }}
          accessibilityLabel={accessibilityLabel ?? label}
          placeholderTextColor={isDark ? '#a0a0a0' : '#9e9e9e'}
          {...props}
        />

        {iconRight ? (
          <TwPressable
            onPress={onIconRightPress}
            accessibilityRole="button"
            accessibilityLabel={iconRightAccessibilityLabel}
            style={{
              padding: 12,
              minHeight: 48,
              minWidth: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SymbolView
              name={iconRight}
              size={18}
              tintColor={isDark ? '#a0a0a0' : '#5c6370'}
              style={{ width: 18, height: 18 }}
            />
          </TwPressable>
        ) : null}
      </TwView>

      {error ? (
        <TwText
          style={{ fontFamily: 'Ubuntu', fontSize: 12, color: '#ba1a1a' }}
          accessibilityRole="alert"
        >
          {error}
        </TwText>
      ) : null}
    </TwView>
  );
}
