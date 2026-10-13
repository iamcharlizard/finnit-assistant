'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TriangleAlert } from 'lucide-react';

import { Label } from '@finnit/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';
import { Switch } from '@finnit/ui/components/ui/switch';

import {
  DEFAULT_MODEL_VALUE,
  PROVIDER_LABELS,
  aiFeatureCopy,
  type AiFeature,
  type AiModel,
} from '@/lib/admin/ai';
import { formatDate } from '@/lib/admin/users';

export interface AiFeatureChange {
  enabled?: boolean;
  aiModelId?: string | null;
  useFallbacks?: boolean;
}

/** One AI feature: on/off, its model (or the catalog default) and fallbacks. */
export function AiFeatureRow({
  feature,
  models,
  onChange,
}: {
  feature: AiFeature;
  /** The models this feature may pick (active; PDF ones for PDF features). */
  models: AiModel[];
  onChange: (change: AiFeatureChange) => Promise<void>;
}) {
  const [saving, setSaving] = React.useState(false);
  const t = useTranslations();
  const locale = useLocale();
  const copy = aiFeatureCopy(feature.key, t);
  const updated = formatDate(feature.updatedAt, locale);
  const id = `feature-${feature.key}`;

  async function save(change: AiFeatureChange) {
    setSaving(true);
    try {
      await onChange(change);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-track p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <label
            htmlFor={`${id}-enabled`}
            className="font-medium text-on-background"
          >
            {copy.label}
          </label>
          {copy.description ? (
            <p className="text-[13px] text-on-surface-variant">
              {copy.description}
            </p>
          ) : null}
        </div>
        <Switch
          id={`${id}-enabled`}
          checked={feature.enabled}
          disabled={saving}
          onCheckedChange={(enabled) => void save({ enabled })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-model`} className="px-1">
            {t('admin.ai.feature.model')}
          </Label>
          <Select
            value={feature.aiModel?.id ?? DEFAULT_MODEL_VALUE}
            disabled={saving}
            onValueChange={(value) =>
              void save({
                aiModelId: value === DEFAULT_MODEL_VALUE ? null : value,
              })
            }
          >
            <SelectTrigger id={`${id}-model`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_MODEL_VALUE}>
                {t('admin.ai.feature.defaultModel')}
              </SelectItem>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label} · {PROVIDER_LABELS[model.provider]}
                </SelectItem>
              ))}
              {/* Its model may have been deactivated since it was picked. */}
              {feature.aiModel &&
              !models.some((m) => m.id === feature.aiModel?.id) ? (
                <SelectItem value={feature.aiModel.id} disabled>
                  {t('admin.ai.feature.inactive', {
                    label: feature.aiModel.label,
                  })}
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3 px-1">
          <label
            htmlFor={`${id}-fallbacks`}
            className="text-sm text-on-background"
          >
            {t('admin.ai.feature.fallbacks')}
          </label>
          <Switch
            id={`${id}-fallbacks`}
            checked={feature.useFallbacks}
            disabled={saving}
            onCheckedChange={(useFallbacks) => void save({ useFallbacks })}
          />
        </div>
      </div>

      {feature.enabled && !feature.usable ? (
        <p role="status" className="flex gap-2 text-[13px] text-expense">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('admin.ai.feature.unusable')}
        </p>
      ) : null}

      <p className="text-[12px] text-on-surface-variant">
        {feature.updatedByName
          ? t('admin.ai.feature.updatedBy', {
              date: updated,
              name: feature.updatedByName,
            })
          : t('admin.ai.feature.updated', { date: updated })}
      </p>
    </div>
  );
}
