import { useState } from 'react';
import type { FieldError, FieldValues, Site } from '@finnit/bank-connect';

import { TwText, TwView } from '@/lib/tw';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';
import { AlertBox } from './alert-box';
import { BankTextField } from './bank-text-field';
import { FlowButton } from './flow-button';
import { OptionPicker } from './option-picker';
import { StepLayout } from './step-layout';

interface CredentialsStepProps {
  site: Site;
  errors: FieldError[];
  message?: string;
  /** Non-secret values to prefill after a failed attempt (never passwords). */
  initialValues?: Record<string, string>;
  onSubmit: (values: FieldValues) => void;
  onChangeBank: () => void;
}

/**
 * The bank's login form, built from Syncfy's field list. Values live only in
 * this component's state and go to Syncfy through the flow.
 */
export function CredentialsStep({ site, errors, message, initialValues, onSubmit, onChangeBank }: CredentialsStepProps) {
  const P = useBankConnectPalette();
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initialValues }));

  const errorOf = (name: string) => errors.find((e) => e.name === name)?.message;
  const setValue = (name: string, value: string) => setValues((prev) => ({ ...prev, [name]: value }));
  const submit = () => onSubmit({ ...values });

  return (
    <StepLayout
      title={site.name}
      description="Escribe tus datos de acceso a la banca en línea. Se envían directamente a Syncfy; Finnit no los ve ni los guarda."
      symbolName="building.columns.fill"
      footer={
        <>
          <FlowButton label="Conectar" onPress={submit} />
          <FlowButton label="Cambiar de banco" variant="ghost" onPress={onChangeBank} />
        </>
      }
    >
      {message ? <AlertBox message={message} /> : null}

      <TwView className="gap-4">
        {site.credentials.map((field) => {
          if (field.type === 'select') {
            return (
              <OptionPicker
                key={field.name}
                label={field.label}
                options={(field.options ?? []).map((o) => ({ value: String(o.value), label: o.label }))}
                value={values[field.name]}
                onChange={(v) => setValue(field.name, v)}
                error={errorOf(field.name)}
              />
            );
          }
          return (
            <BankTextField
              key={field.name}
              label={field.label}
              value={values[field.name] ?? ''}
              onChangeText={(v) => setValue(field.name, v)}
              error={errorOf(field.name)}
              secure={field.type === 'password'}
            />
          );
        })}
      </TwView>

      <TwText style={{ fontFamily: 'Ubuntu', fontSize: 12, lineHeight: 18, color: P.onSurfaceVariant }}>
        Usa los mismos datos con los que entras a la app o sitio de tu banco.
      </TwText>
    </StepLayout>
  );
}
