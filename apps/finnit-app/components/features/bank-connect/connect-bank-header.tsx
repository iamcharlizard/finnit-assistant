import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TwPressable, TwText, TwView } from '@/lib/tw';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';

interface ConnectBankHeaderProps {
  onClose: () => void;
}

/** Title bar of the flow with a close button (leaving cancels any ongoing login). */
export function ConnectBankHeader({ onClose }: ConnectBankHeaderProps) {
  const P = useBankConnectPalette();
  const insets = useSafeAreaInsets();

  return (
    <TwView
      className="flex-row items-center justify-between px-2 border-b"
      style={{
        paddingTop: insets.top + 4,
        paddingBottom: 4,
        borderColor: P.outline,
        backgroundColor: P.isDark ? 'rgba(18, 19, 26, 0.88)' : 'rgba(255, 255, 255, 0.88)',
      }}
    >
      <TwView style={{ width: 44 }} />
      <TwText accessibilityRole="header" style={{ fontFamily: 'Ubuntu Bold', fontSize: 18, color: P.onSurface }}>
        Conectar banco
      </TwText>
      <TwPressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <SymbolView name="xmark" size={18} tintColor={P.onSurfaceVariant} accessibilityLabel="" />
      </TwPressable>
    </TwView>
  );
}
