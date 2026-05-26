import { TwView, TwTextInput, TwText } from '../../lib/tw';
import type { TextInputProps } from 'react-native';
import { useColorScheme } from 'nativewind';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
  accessibilityLabel?: string;
}

export function Input({
  label,
  error,
  className = '',
  accessibilityLabel,
  ...props
}: InputProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TwView className="gap-1">
      {label ? (
        <TwText
          className="text-[12px] font-medium text-on-surface-variant uppercase tracking-widest"
          style={{ fontFamily: 'Ubuntu Medium' }}
        >
          {label}
        </TwText>
      ) : null}

      <TwTextInput
        className={`rounded-[12px] px-4 py-3 border text-[16px] text-on-background ${
          isDark
            ? 'bg-surface-dark border-outline-dark'
            : 'bg-surface border-outline'
        } ${error ? 'border-red-500' : ''} ${className}`}
        style={{
          fontFamily: 'Ubuntu',
          minHeight: 44,
        }}
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={isDark ? '#a0a0a0' : '#5c6370'}
        {...props}
      />

      {error ? (
        <TwText
          className="text-red-500 text-[12px]"
          style={{ fontFamily: 'Ubuntu' }}
          accessibilityRole="alert"
        >
          {error}
        </TwText>
      ) : null}
    </TwView>
  );
}
