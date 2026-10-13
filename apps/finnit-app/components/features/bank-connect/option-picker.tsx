import { SymbolView } from 'expo-symbols';

import { TwPressable, TwText, TwView } from '@/lib/tw';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';

export interface PickerOption {
  value: string;
  label: string;
  /** Secondary line under the label. */
  detail?: string;
  disabled?: boolean;
}

interface OptionPickerProps {
  label?: string;
  options: PickerOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  error?: string;
}

/** Single-choice list of labels (radio group), no extra dependencies. */
export function OptionPicker({ label, options, value, onChange, error }: OptionPickerProps) {
  const P = useBankConnectPalette();

  return (
    <TwView className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? (
        <TwText
          style={{ fontFamily: 'Ubuntu Medium', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: P.onSurfaceVariant }}
        >
          {label}
        </TwText>
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TwPressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={option.disabled}
            className="flex-row items-center gap-3 px-3 rounded-xl active:opacity-70"
            style={{
              minHeight: 48,
              backgroundColor: selected ? P.selectedBg : P.rowBg,
              borderWidth: 1,
              borderColor: selected ? P.primary : 'transparent',
              opacity: option.disabled ? 0.5 : 1,
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.detail ? `${option.label}, ${option.detail}` : option.label}
            accessibilityState={{ checked: selected, disabled: option.disabled }}
          >
            <SymbolView
              name={selected ? 'largecircle.fill.circle' : 'circle'}
              size={20}
              tintColor={selected ? P.primary : P.onSurfaceVariant}
              accessibilityLabel=""
            />
            <TwView className="flex-1 py-2">
              <TwText style={{ fontFamily: 'Ubuntu', fontSize: 15, color: P.onSurface }}>{option.label}</TwText>
              {option.detail ? (
                <TwText style={{ fontFamily: 'Ubuntu', fontSize: 12, color: P.onSurfaceVariant, marginTop: 2 }}>
                  {option.detail}
                </TwText>
              ) : null}
            </TwView>
          </TwPressable>
        );
      })}
      {error ? (
        <TwText style={{ fontFamily: 'Ubuntu', fontSize: 12, color: P.error }} accessibilityRole="alert">
          {error}
        </TwText>
      ) : null}
    </TwView>
  );
}
