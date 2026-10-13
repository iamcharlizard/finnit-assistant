'use client';

import * as React from 'react';
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
  AI_FEATURE_COPY,
  DEFAULT_MODEL_VALUE,
  PROVIDER_LABELS,
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
  pdfModels,
  onChange,
}: {
  feature: AiFeature;
  /** Active models that read PDF: the ones a feature may pick. */
  pdfModels: AiModel[];
  onChange: (change: AiFeatureChange) => Promise<void>;
}) {
  const [saving, setSaving] = React.useState(false);
  const copy = AI_FEATURE_COPY[feature.key] ?? {
    label: feature.key,
    description: '',
  };
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
          <p className="text-[13px] text-on-surface-variant">
            {copy.description}
          </p>
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
            Modelo
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
                Predeterminado del catálogo
              </SelectItem>
              {pdfModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label} · {PROVIDER_LABELS[model.provider]}
                </SelectItem>
              ))}
              {/* Its model may have been deactivated since it was picked. */}
              {feature.aiModel &&
              !pdfModels.some((m) => m.id === feature.aiModel?.id) ? (
                <SelectItem value={feature.aiModel.id} disabled>
                  {feature.aiModel.label} (inactivo)
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
            Usar otros modelos si falla
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
          Ningún modelo disponible: activa uno con su llave configurada.
        </p>
      ) : null}

      <p className="text-[12px] text-on-surface-variant">
        Actualizado el {formatDate(feature.updatedAt)}
        {feature.updatedByName ? ` por ${feature.updatedByName}` : ''}
      </p>
    </div>
  );
}
