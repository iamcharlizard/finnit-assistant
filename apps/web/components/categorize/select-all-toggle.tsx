'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Checkbox } from '@finnit/ui/components/ui/checkbox';

/** "Seleccionar todo" for the movements on screen. */
export function SelectAllToggle({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('categorize');
  const id = React.useId();
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-3 pl-3 pr-2 text-sm font-medium text-on-background"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      {t('selectAll')}
    </label>
  );
}
