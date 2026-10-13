'use client';

import type { TwofaField as TwofaFieldDefinition } from '@finnit/bank-connect';

import { Input } from '@finnit/ui/components/ui/input';
import { cn } from '@finnit/ui/lib/utils';

/**
 * One thing the bank asks for: a code (maybe with a captcha image), a
 * choice among images or labels, or an action outside Finnit (QR).
 */
export function TwofaField({
  field,
  value,
  error,
  onChange,
}: {
  field: TwofaFieldDefinition;
  value: string | number | undefined;
  error?: string;
  onChange: (value: string | number) => void;
}) {
  const id = `twofa-${field.name}`;
  const errorText = error ? (
    <p id={`${id}-error`} className="text-[13px] text-expense">
      {error}
    </p>
  ) : null;

  if (field.type === 'options' || field.type === 'textOptions') {
    const images = field.type === 'options';
    return (
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-on-background">
          {field.label}
        </legend>
        <div
          className={cn('grid gap-2', images ? 'grid-cols-3' : 'grid-cols-1')}
        >
          {field.options?.map((option) => {
            const selected = String(option.value) === String(value);
            return (
              <button
                key={String(option.value)}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(option.value)}
                className={cn(
                  'flex min-h-12 items-center justify-center rounded-xl border p-2 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  selected
                    ? 'border-accent-neon bg-accent-neon/10 text-on-background'
                    : 'border-outline bg-track text-on-surface-variant hover:bg-accent',
                )}
              >
                {images && option.imgBase64File ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URI from the bank
                  <img
                    src={option.imgBase64File}
                    alt={`Opción ${String(option.value)}`}
                    className="max-h-20 object-contain"
                  />
                ) : (
                  (option.label ?? String(option.value))
                )}
              </button>
            );
          })}
        </div>
        {errorText}
      </fieldset>
    );
  }

  if (field.type === 'externalAction') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-on-background">{field.label}</p>
        {field.imgBase64File ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URI from the bank
          <img
            src={field.imgBase64File}
            alt="Código QR de tu banco"
            className="size-56 rounded-xl bg-white object-contain p-2"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {field.imgBase64File ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI from the bank
        <img
          src={field.imgBase64File}
          alt="Imagen de verificación"
          className="max-h-24 self-start rounded-lg bg-white object-contain p-1"
        />
      ) : null}
      <Input
        id={id}
        label={field.label}
        error={error}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="one-time-code"
        inputMode={
          /token|codigo|código|otp/i.test(field.label) ? 'numeric' : undefined
        }
        autoFocus
      />
    </div>
  );
}
