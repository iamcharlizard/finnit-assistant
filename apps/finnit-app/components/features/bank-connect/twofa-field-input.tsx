import type { TwofaField } from '@finnit/bank-connect';

import { TwPressable, TwText, TwView } from '@/lib/tw';
import { TwImage } from '@/lib/tw/image';
import { toImageUri } from '@/lib/bank-connect/format';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';
import { BankTextField } from './bank-text-field';
import { OptionPicker } from './option-picker';

interface TwofaFieldInputProps {
  field: TwofaField;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  error?: string;
}

/** One thing the bank asks for during the login (code, captcha, image choice, QR…). */
export function TwofaFieldInput({ field, value, onChange, error }: TwofaFieldInputProps) {
  const P = useBankConnectPalette();
  const options = field.options ?? [];

  if (field.type === 'options') {
    return (
      <TwView className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={field.label}>
        <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 15, color: P.onSurface }}>{field.label}</TwText>
        <TwView className="flex-row flex-wrap gap-3">
          {options.map((option, index) => {
            const selected = value !== undefined && String(option.value) === String(value);
            return (
              <TwPressable
                key={String(option.value)}
                onPress={() => onChange(option.value)}
                className="rounded-xl p-2 items-center justify-center active:opacity-70"
                style={{
                  minWidth: 88,
                  minHeight: 88,
                  backgroundColor: selected ? P.selectedBg : P.rowBg,
                  borderWidth: 2,
                  borderColor: selected ? P.primary : 'transparent',
                }}
                accessibilityRole="radio"
                accessibilityLabel={option.label ?? `Opción ${index + 1}`}
                accessibilityState={{ checked: selected }}
              >
                {option.imgBase64File ? (
                  <TwImage
                    source={{ uri: toImageUri(option.imgBase64File) }}
                    style={{ width: 72, height: 72 }}
                    contentFit="contain"
                    accessibilityLabel={option.label ?? `Opción ${index + 1}`}
                  />
                ) : (
                  <TwText style={{ fontFamily: 'Ubuntu', fontSize: 14, color: P.onSurface }}>
                    {option.label ?? String(option.value)}
                  </TwText>
                )}
              </TwPressable>
            );
          })}
        </TwView>
        {error ? (
          <TwText style={{ fontFamily: 'Ubuntu', fontSize: 12, color: P.error }} accessibilityRole="alert">
            {error}
          </TwText>
        ) : null}
      </TwView>
    );
  }

  if (field.type === 'textOptions') {
    return (
      <OptionPicker
        label={field.label}
        options={options.map((o) => ({ value: String(o.value), label: o.label ?? String(o.value) }))}
        value={value === undefined ? undefined : String(value)}
        onChange={(selected) => {
          // Send the option's original value (it may be a number).
          const option = options.find((o) => String(o.value) === selected);
          onChange(option ? option.value : selected);
        }}
        error={error}
      />
    );
  }

  if (field.type === 'externalAction') {
    return (
      <TwView className="gap-3 items-center">
        {field.imgBase64File ? (
          <TwImage
            source={{ uri: toImageUri(field.imgBase64File) }}
            style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: '#ffffff' }}
            contentFit="contain"
            accessibilityLabel="Código QR de tu banco"
          />
        ) : null}
        <TwText className="text-center" style={{ fontFamily: 'Ubuntu', fontSize: 15, lineHeight: 22, color: P.onSurface }}>
          {field.label}
        </TwText>
      </TwView>
    );
  }

  // 'text': type a code; a captcha image may come with it.
  return (
    <TwView className="gap-2">
      {field.imgBase64File ? (
        <TwImage
          source={{ uri: toImageUri(field.imgBase64File) }}
          style={{ width: '100%', height: 80, borderRadius: 8, backgroundColor: '#ffffff' }}
          contentFit="contain"
          accessibilityLabel="Imagen de verificación"
        />
      ) : null}
      <BankTextField
        label={field.label}
        value={value === undefined ? '' : String(value)}
        onChangeText={onChange}
        error={error}
      />
    </TwView>
  );
}
