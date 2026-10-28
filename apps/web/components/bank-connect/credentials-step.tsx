'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, ArrowLeft, Lock } from 'lucide-react';
import type { FieldError, FieldValues, Site } from '@finnit/bank-connect';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

import { SiteField } from './site-field';

export function CredentialsStep({
  site,
  errors,
  message,
  onSubmit,
  onBack,
}: {
  site: Site;
  errors: FieldError[];
  message?: string;
  onSubmit: (values: FieldValues) => void;
  onBack: () => void;
}) {
  // Bank credentials live only in this component's state and are dropped
  // when the step unmounts.
  const [values, setValues] = React.useState<Record<string, string>>({});
  const t = useTranslations('bankConnect.credentials');
  const errorOf = (name: string) =>
    errors.find((e) => e.name === name)?.message;

  return (
    <form
      className="flex flex-col gap-5"
      autoComplete="off"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div>
        <TitleLg as="h2">{site.name}</TitleLg>
        <BodyMd className="mt-1 flex items-center gap-1.5 text-[13px] text-on-surface-variant">
          <Lock aria-hidden className="size-3.5" />
          {t('hint')}
        </BodyMd>
      </div>

      {message ? (
        <div
          role="alert"
          className="flex gap-2 rounded-xl border border-expense/30 bg-expense/10 p-3 text-[13px] text-expense"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {message}
        </div>
      ) : null}

      {site.credentials.map((field) => (
        <SiteField
          key={field.name}
          field={field}
          value={values[field.name] ?? ''}
          error={errorOf(field.name)}
          onChange={(value) =>
            setValues((v) => ({ ...v, [field.name]: value }))
          }
        />
      ))}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" /> {t('changeBank')}
        </Button>
        <Button type="submit" variant="secondary">
          {t('connect')}
        </Button>
      </div>
    </form>
  );
}
