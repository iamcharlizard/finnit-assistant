'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Star, Trash2 } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { NumberInput } from '@finnit/ui/components/ui/number-input';
import { Switch } from '@finnit/ui/components/ui/switch';

import { PROVIDER_LABELS, type AiModel } from '@/lib/admin/ai';

export interface AiModelChange {
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

/** One catalog model: badges, active switch, default, order and delete. */
export function AiModelRow({
  model,
  onChange,
  onDelete,
}: {
  model: AiModel;
  onChange: (change: AiModelChange) => Promise<void>;
  onDelete: () => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const t = useTranslations('admin.ai.model');
  const [order, setOrder] = React.useState(String(model.sortOrder));
  const id = `model-${model.id}`;

  // Show the saved order again after a reload.
  React.useEffect(() => setOrder(String(model.sortOrder)), [model.sortOrder]);

  async function save(change: AiModelChange) {
    setSaving(true);
    try {
      await onChange(change);
    } finally {
      setSaving(false);
    }
  }

  function commitOrder() {
    const value = Number.parseInt(order, 10);
    if (Number.isNaN(value) || value < 0) {
      setOrder(String(model.sortOrder));
    } else if (value !== model.sortOrder) {
      void save({ sortOrder: value });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-track p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-on-background">{model.label}</span>
          <span className="text-[13px] text-on-surface-variant">
            {PROVIDER_LABELS[model.provider]}
          </span>
        </div>
        <p className="truncate font-mono text-[12px] text-on-surface-variant">
          {model.modelId}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {model.isDefault ? (
            <Badge variant="brand">{t('default')}</Badge>
          ) : null}
          {model.supportsPdf ? <Badge variant="muted">{t('pdf')}</Badge> : null}
          {!model.providerConfigured ? (
            <Badge variant="expense">{t('noKey')}</Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor={`${id}-order`}
            className="text-[13px] text-on-surface-variant"
          >
            {t('order')}
          </label>
          <NumberInput
            id={`${id}-order`}
            maxDigits={4}
            value={order}
            disabled={saving}
            onValueChange={setOrder}
            onBlur={commitOrder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="w-20 px-3"
          />
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor={`${id}-active`}
            className="text-[13px] text-on-surface-variant"
          >
            {t('active')}
          </label>
          <Switch
            id={`${id}-active`}
            checked={model.isActive}
            disabled={saving}
            onCheckedChange={(isActive) => void save({ isActive })}
          />
        </div>
        {!model.isDefault ? (
          <Button
            variant="outline"
            size="sm"
            disabled={saving || !model.isActive}
            title={model.isActive ? undefined : t('activateFirst')}
            onClick={() => void save({ isDefault: true })}
          >
            <Star className="size-4" /> {t('makeDefault')}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('deleteLabel', { label: model.label })}
          disabled={saving}
          onClick={onDelete}
          className="text-expense"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
