import { SymbolView } from 'expo-symbols';

import { TwView, TwText } from '@/lib/tw';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';

interface AlertBoxProps {
  message: string;
  tone?: 'error' | 'warning';
}

/** Inline message from the bank or the flow (e.g. wrong password). */
export function AlertBox({ message, tone = 'error' }: AlertBoxProps) {
  const P = useBankConnectPalette();
  const color = tone === 'error' ? P.error : P.warning;
  const backgroundColor = tone === 'error' ? P.errorBg : P.warningBg;

  return (
    <TwView
      className="flex-row gap-3 rounded-xl p-3 items-start"
      style={{ backgroundColor, borderWidth: 1, borderColor: `${color}55` }}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <SymbolView name="exclamationmark.triangle.fill" size={18} tintColor={color} accessibilityLabel="" />
      <TwText className="flex-1" style={{ fontFamily: 'Ubuntu', fontSize: 14, lineHeight: 20, color }}>
        {message}
      </TwText>
    </TwView>
  );
}
