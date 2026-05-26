// TODO: evaluar si mover a ui/ si resulta ser genérico

import { TwView, TwText } from '../../../lib/tw';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useColorScheme } from 'nativewind';

type SymbolName = SymbolViewProps['name'];

interface SpendingCategoryCardProps {
  label: string;
  amount: string;
  percent: number;
  symbolName: SymbolName;
  accentColor: string;
}

export function SpendingCategoryCard({
  label,
  amount,
  percent,
  symbolName,
  accentColor,
}: SpendingCategoryCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TwView
      className={`flex-1 rounded-[16px] p-3 ${
        isDark ? 'border border-white/5' : 'border border-outline'
      }`}
      style={{
        // NW-FALLBACK: rgba glassmorphism, border-white/5 not reliable cross-platform
        backgroundColor: isDark
          ? 'rgba(26, 27, 34, 0.85)'
          : 'rgba(255, 255, 255, 0.9)',
      }}
    >
      <TwView
        className="w-9 h-9 rounded-[10px] items-center justify-center mb-2"
        style={{ backgroundColor: `${accentColor}28` }}
      >
        <SymbolView
          name={symbolName}
          size={18}
          tintColor={accentColor}
          accessibilityLabel=""
        />
      </TwView>

      <TwText
        className={`text-[14px] font-bold mb-0.5 ${
          isDark ? 'text-on-background-dark' : 'text-on-background'
        }`}
        style={{ fontFamily: 'Ubuntu Bold' }}
        numberOfLines={1}
      >
        {amount}
      </TwText>

      <TwText
        className={`text-[11px] mb-2.5 ${
          isDark ? 'text-on-surface-variant-dark' : 'text-on-surface-variant'
        }`}
        style={{ fontFamily: 'Ubuntu' }}
        numberOfLines={1}
      >
        {label}
      </TwText>

      {/* Progress bar */}
      <TwView
        className="h-1 rounded-full overflow-hidden"
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <TwView
          className="h-full rounded-full"
          style={{ width: `${percent}%`, backgroundColor: accentColor }}
        />
      </TwView>

      <TwText
        className={`text-[10px] mt-1 ${
          isDark ? 'text-on-surface-variant-dark' : 'text-on-surface-variant'
        }`}
        style={{ fontFamily: 'Ubuntu' }}
      >
        {percent}%
      </TwText>
    </TwView>
  );
}
