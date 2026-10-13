import { useState } from 'react';
import type { FieldError, FieldValues, Site, TwofaField } from '@finnit/bank-connect';

import { TwView } from '@/lib/tw';
import { FlowButton } from './flow-button';
import { StepLayout } from './step-layout';
import { TwofaFieldInput } from './twofa-field-input';

interface TwofaStepProps {
  site: Site;
  fields: TwofaField[];
  errors: FieldError[];
  onSubmit: (values: FieldValues) => void;
}

/** Second factor(s) the bank asked for. Answers go to Syncfy through the flow. */
export function TwofaStep({ site, fields, errors, onSubmit }: TwofaStepProps) {
  const [values, setValues] = useState<FieldValues>({});

  const onlyExternal = fields.length > 0 && fields.every((f) => f.type === 'externalAction');
  const errorOf = (name: string) => errors.find((e) => e.name === name)?.message;

  return (
    <StepLayout
      title="Verificación de tu banco"
      description={`${site.name} pide un dato adicional para continuar.`}
      symbolName="key.fill"
      footer={
        onlyExternal ? (
          // Nothing is sent for external actions: Syncfy detects them by itself.
          <FlowButton label="Ya lo hice" onPress={() => onSubmit({})} />
        ) : (
          <FlowButton label="Continuar" onPress={() => onSubmit({ ...values })} />
        )
      }
    >
      <TwView className="gap-5">
        {fields.map((field) => (
          <TwofaFieldInput
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))}
            error={errorOf(field.name)}
          />
        ))}
      </TwView>
    </StepLayout>
  );
}
