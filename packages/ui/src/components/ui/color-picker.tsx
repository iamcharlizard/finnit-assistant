'use client';

import * as React from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { CheckIcon, PipetteIcon } from 'lucide-react';

import { isHexColor, normalizeHex, readableTextColor } from '../../lib/color';
import { cn } from '../../lib/utils';

interface ColorPreset {
  /** '#RRGGBB'. */
  value: string;
  /** Accessible name of the swatch (e.g. "Teal"). */
  label: string;
}

const DEFAULT_COLOR_PRESETS: ColorPreset[] = [
  { value: '#00696E', label: 'Teal' },
  { value: '#006688', label: 'Ocean' },
  { value: '#5B61C2', label: 'Indigo' },
  { value: '#9500CA', label: 'Purple' },
  { value: '#AD009B', label: 'Magenta' },
  { value: '#BA1A1A', label: 'Red' },
  { value: '#E8590C', label: 'Orange' },
  { value: '#F2B600', label: 'Yellow' },
  { value: '#2B8A3E', label: 'Green' },
  { value: '#252730', label: 'Graphite' },
];

const STRICT_HEX = /^#[0-9a-f]{6}$/i;

interface ColorPickerProps {
  /** Current color as '#RRGGBB'. */
  value?: string;
  /** Initial color when uncontrolled. */
  defaultValue?: string;
  /** Always called with an uppercase '#RRGGBB'. */
  onChange?: (value: string) => void;
  presets?: ColorPreset[];
  disabled?: boolean;
  className?: string;
  /* Texts (English defaults). */
  /** Accessible name of the swatch group. */
  swatchesLabel?: string;
  customLabel?: string;
  hexLabel?: string;
  invalidHexText?: string;
}

function ColorPicker({
  value,
  defaultValue,
  onChange,
  presets = DEFAULT_COLOR_PRESETS,
  disabled = false,
  className,
  swatchesLabel = 'Preset colors',
  customLabel = 'Custom color',
  hexLabel = 'Hex code',
  invalidHexText = 'Use the format #RRGGBB.',
}: ColorPickerProps) {
  const id = React.useId();
  const hexId = `${id}-hex`;
  const errorId = `${id}-hex-error`;

  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const raw = value ?? internalValue;
  const current = raw && isHexColor(raw) ? normalizeHex(raw) : undefined;
  const presetMatch = presets.find(
    (preset) => normalizeHex(preset.value) === current,
  );

  // Draft text for the hex field; resynced when `value` changes from outside.
  const [draft, setDraft] = React.useState(current ?? '');
  const [syncedValue, setSyncedValue] = React.useState(current);
  const [showError, setShowError] = React.useState(false);
  if (syncedValue !== current) {
    setSyncedValue(current);
    setDraft(current ?? '');
    setShowError(false);
  }

  const commit = (hex: string) => {
    const normalized = normalizeHex(hex);
    setDraft(normalized);
    setShowError(false);
    if (value === undefined) setInternalValue(normalized);
    onChange?.(normalized);
  };

  const draftIsValid = STRICT_HEX.test(draft);

  return (
    <div
      data-slot="color-picker"
      className={cn('flex flex-col gap-4', className)}
    >
      <RadioGroupPrimitive.Root
        aria-label={swatchesLabel}
        value={presetMatch ? normalizeHex(presetMatch.value) : ''}
        onValueChange={commit}
        disabled={disabled}
        orientation="horizontal"
        loop
        className="flex flex-wrap gap-2"
      >
        {presets.map((preset) => {
          const hex = normalizeHex(preset.value);
          return (
            <RadioGroupPrimitive.Item
              key={hex}
              value={hex}
              aria-label={preset.label}
              title={preset.label}
              className={cn(
                'relative flex size-9 items-center justify-center rounded-full border border-black/10 outline-none transition-transform hover:scale-105 dark:border-white/15',
                'focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'data-[state=checked]:ring-2 data-[state=checked]:ring-on-background data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-background',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100',
              )}
              style={{ backgroundColor: hex }}
            >
              <RadioGroupPrimitive.Indicator>
                <CheckIcon
                  aria-hidden
                  className="size-4"
                  style={{ color: readableTextColor(hex) }}
                />
              </RadioGroupPrimitive.Indicator>
            </RadioGroupPrimitive.Item>
          );
        })}
      </RadioGroupPrimitive.Root>

      <div className="flex items-start gap-3">
        <label
          className={cn(
            'relative flex size-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-input outline-none has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          style={current ? { backgroundColor: current } : undefined}
        >
          <PipetteIcon
            aria-hidden
            className="size-4"
            style={{
              color: current ? readableTextColor(current) : undefined,
            }}
          />
          <span className="sr-only">{customLabel}</span>
          <input
            type="color"
            disabled={disabled}
            value={(current ?? '#000000').toLowerCase()}
            onChange={(event) => commit(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </label>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={hexId} className="sr-only">
            {hexLabel}
          </label>
          <input
            id={hexId}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={7}
            placeholder="#RRGGBB"
            disabled={disabled}
            value={draft}
            aria-invalid={showError ? true : undefined}
            aria-describedby={showError ? errorId : undefined}
            onChange={(event) => {
              let next = event.target.value.trim();
              if (next && !next.startsWith('#')) next = `#${next}`;
              setDraft(next.toUpperCase());
              if (STRICT_HEX.test(next)) commit(next);
            }}
            onBlur={() => setShowError(draft !== '' && !draftIsValid)}
            className={cn(
              'min-h-11 w-full min-w-0 rounded-input border border-input bg-surface px-4 py-2 font-mono text-sm uppercase text-on-background outline-none transition-[color,box-shadow] placeholder:text-on-surface-variant/70 disabled:cursor-not-allowed disabled:opacity-50',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
              'aria-invalid:border-expense aria-invalid:ring-expense/20',
            )}
          />
          {showError ? (
            <p id={errorId} role="alert" className="text-xs text-expense">
              {invalidHexText}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export {
  ColorPicker,
  DEFAULT_COLOR_PRESETS,
  type ColorPickerProps,
  type ColorPreset,
};
