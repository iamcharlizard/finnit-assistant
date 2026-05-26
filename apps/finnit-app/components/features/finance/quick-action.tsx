import { TwView, TwText, TwPressable } from '../../../lib/tw';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useColorScheme } from 'nativewind';

type SymbolName = SymbolViewProps['name'];

interface QuickActionProps {
  label: string;
  symbolName: SymbolName;
  onPress: () => void;
  accessibilityLabel?: string;
}

export function QuickAction({ label, symbolName, onPress, accessibilityLabel }: QuickActionProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark
    ? 'rgba(108, 114, 203, 0.2)'
    : 'rgba(0, 245, 255, 0.12)';

  const iconColor = isDark ? '#6c72cb' : '#00b8c0';

  return (
    <TwPressable
      className="items-center gap-2"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={{ minWidth: 56, minHeight: 44 }}
    >
      <TwView
        className="w-14 h-14 rounded-full items-center justify-center"
        style={{ backgroundColor: bgColor }}
      >
        <SymbolView
          name={symbolName}
          size={24}
          tintColor={iconColor}
          accessibilityLabel=""
        />
      </TwView>

      <TwText
        className={`text-[12px] text-center ${isDark ? 'text-on-surface-variant-dark' : 'text-on-surface-variant'}`}
        style={{ fontFamily: 'Ubuntu' }}
      >
        {label}
      </TwText>
    </TwPressable>
  );
}
