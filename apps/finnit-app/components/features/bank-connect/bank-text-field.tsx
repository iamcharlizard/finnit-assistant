import { useState } from 'react';
import { SymbolView } from 'expo-symbols';

import { Input } from '@/components/ui/input';
import { TwPressable, TwText, TwView } from '@/lib/tw';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';

interface BankTextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  /** Password-like field: hidden by default, with a show/hide toggle. */
  secure?: boolean;
  onSubmitEditing?: () => void;
}

/**
 * Text input for bank logins and codes. Nothing typed here is saved by the
 * OS: no autocorrect, no autofill and no password-manager hints.
 */
export function BankTextField({ label, value, onChangeText, error, secure = false, onSubmitEditing }: BankTextFieldProps) {
  const P = useBankConnectPalette();
  const [visible, setVisible] = useState(false);

  return (
    <TwView className="gap-1">
      <TwText
        style={{ fontFamily: 'Ubuntu Medium', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: P.onSurfaceVariant }}
      >
        {label}
      </TwText>
      <TwView className="flex-row items-center gap-2">
        <TwView className="flex-1">
          <Input
            value={value}
            onChangeText={onChangeText}
            accessibilityLabel={label}
            secureTextEntry={secure && !visible}
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            spellCheck={false}
            returnKeyType="next"
            onSubmitEditing={onSubmitEditing}
            style={{
              fontFamily: 'Ubuntu',
              minHeight: 44,
              color: P.onSurface,
              borderColor: error ? P.error : P.outline,
            }}
          />
        </TwView>
        {secure ? (
          <TwPressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? `Ocultar ${label}` : `Mostrar ${label}`}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <SymbolView
              name={visible ? 'eye.slash.fill' : 'eye.fill'}
              size={20}
              tintColor={P.onSurfaceVariant}
              accessibilityLabel=""
            />
          </TwPressable>
        ) : null}
      </TwView>
      {error ? (
        <TwText style={{ fontFamily: 'Ubuntu', fontSize: 12, color: P.error }} accessibilityRole="alert">
          {error}
        </TwText>
      ) : null}
    </TwView>
  );
}
