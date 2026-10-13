'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Checkbox } from '@finnit/ui/components/ui/checkbox';
import { Combobox } from '@finnit/ui/components/ui/combobox';

import type { PickerOption } from '@/lib/new-entry/options';

/**
 * Sticky bar while movements are selected: "Mover a…" a category, with
 * "Recordar para este comercio" (creates merchant rules) on by default.
 */
export function MoveBar({
  count,
  categories,
  busy,
  onMove,
  onClear,
}: {
  count: number;
  categories: PickerOption[];
  busy: boolean;
  onMove: (categoryId: string, remember: boolean) => void;
  onClear: () => void;
}) {
  const t = useTranslations('categorize');
  const [categoryId, setCategoryId] = React.useState<string | undefined>();
  const [remember, setRemember] = React.useState(true);
  const rememberId = React.useId();

  return (
    <div
      role="region"
      aria-label={t('actionsLabel')}
      className="sticky bottom-24 z-20 mt-4 flex flex-col gap-3 rounded-card border border-outline bg-surface/95 p-3 shadow-lg backdrop-blur-xl sm:flex-row sm:flex-wrap sm:items-center lg:bottom-4"
    >
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <p
          className="text-sm font-medium text-on-background"
          aria-live="polite"
        >
          {t('selected', { count })}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          aria-label={t('clearSelection')}
        >
          <X aria-hidden />
          <span className="sm:sr-only">{t('clearSelection')}</span>
        </Button>
      </div>
      <div className="min-w-0 sm:w-64">
        <Combobox
          options={categories}
          value={categoryId}
          onChange={setCategoryId}
          placeholder={t('moveTo')}
          searchPlaceholder={t('searchCategory')}
          emptyText={t('noCategories')}
          aria-label={t('moveTo')}
        />
      </div>
      <label
        htmlFor={rememberId}
        className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-on-background"
      >
        <Checkbox
          id={rememberId}
          checked={remember}
          onCheckedChange={(v) => setRemember(v === true)}
        />
        {t('remember')}
      </label>
      <Button
        className="sm:ml-auto"
        disabled={!categoryId || busy}
        onClick={() => categoryId && onMove(categoryId, remember)}
      >
        {busy ? t('applying') : t('apply')}
      </Button>
    </div>
  );
}
