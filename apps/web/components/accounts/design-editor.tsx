'use client';

import { useTranslations } from 'next-intl';

import {
  ColorPicker,
  DEFAULT_COLOR_PRESETS,
} from '@finnit/ui/components/ui/color-picker';
import { Label } from '@finnit/ui/components/ui/label';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@finnit/ui/components/ui/toggle-group';

import type { DesignMode, DesignValue } from '@/lib/accounts/form';

const MODES: DesignMode[] = ['preset', 'solid', 'gradient'];

// DEFAULT_COLOR_PRESETS order: teal, ocean, indigo, purple, magenta, red,
// orange, yellow, green, graphite.
const COLOR_KEYS = [
  'teal',
  'ocean',
  'indigo',
  'purple',
  'magenta',
  'red',
  'orange',
  'yellow',
  'green',
  'graphite',
] as const;

/** Card look: Finnit's preset, one color or a two-color gradient. */
export function DesignEditor({
  value,
  onChange,
}: {
  value: DesignValue;
  onChange: (value: DesignValue) => void;
}) {
  const t = useTranslations('accounts.design');
  const te = useTranslations('accounts.errors');
  const presets = DEFAULT_COLOR_PRESETS.map((preset, i) => ({
    value: preset.value,
    label: COLOR_KEYS[i] ? t(`colors.${COLOR_KEYS[i]}`) : preset.label,
  }));
  const pickerTexts = {
    swatchesLabel: t('swatches'),
    customLabel: t('custom'),
    hexLabel: t('hex'),
    // The picker only reports valid colors; this shows while typing.
    invalidHexText: te('hex'),
  };

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        aria-label={t('modeLabel')}
        value={value.mode}
        onValueChange={(mode) =>
          mode && onChange({ ...value, mode: mode as DesignMode })
        }
        className="flex-wrap"
      >
        {MODES.map((mode) => (
          <ToggleGroupItem key={mode} value={mode} className="px-4">
            {t(mode)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {value.mode !== 'preset' ? (
        <div className="flex flex-col gap-2">
          <Label>{t('primary')}</Label>
          <ColorPicker
            value={value.primary}
            onChange={(primary) => onChange({ ...value, primary })}
            presets={presets}
            {...pickerTexts}
          />
        </div>
      ) : null}
      {value.mode === 'gradient' ? (
        <div className="flex flex-col gap-2">
          <Label>{t('secondary')}</Label>
          <ColorPicker
            value={value.secondary}
            onChange={(secondary) => onChange({ ...value, secondary })}
            presets={presets}
            {...pickerTexts}
          />
        </div>
      ) : null}
      {value.mode !== 'preset' ? (
        <p className="text-xs text-on-surface-variant">{t('textNote')}</p>
      ) : null}
    </div>
  );
}
