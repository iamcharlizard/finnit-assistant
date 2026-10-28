'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ShieldEllipsis } from 'lucide-react';
import type {
  FieldError,
  FieldValues,
  Site,
  TwofaField as TwofaFieldDefinition,
} from '@finnit/bank-connect';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

import { TwofaField } from './twofa-field';

export function TwofaStep({
  site,
  fields,
  errors,
  onSubmit,
}: {
  site: Site;
  fields: TwofaFieldDefinition[];
  errors: FieldError[];
  onSubmit: (values: FieldValues) => void;
}) {
  const [values, setValues] = React.useState<FieldValues>({});
  const t = useTranslations('bankConnect.twofa');
  const onlyExternal = fields.every((f) => f.type === 'externalAction');

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent-neon/15 text-accent-neon">
          <ShieldEllipsis aria-hidden className="size-6" />
        </span>
        <div>
          <TitleLg as="h2">{t('title', { bank: site.name })}</TitleLg>
          <BodyMd className="text-[13px] text-on-surface-variant">
            {t('hint')}
          </BodyMd>
        </div>
      </div>

      {fields.map((field) => (
        <TwofaField
          key={field.name}
          field={field}
          value={values[field.name]}
          error={errors.find((e) => e.name === field.name)?.message}
          onChange={(value) =>
            setValues((v) => ({ ...v, [field.name]: value }))
          }
        />
      ))}

      <Button type="submit" variant="secondary" className="self-end">
        {onlyExternal ? t('alreadyDone') : t('continue')}
      </Button>
    </form>
  );
}
