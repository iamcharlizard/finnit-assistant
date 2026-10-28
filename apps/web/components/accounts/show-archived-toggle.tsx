'use client';

import { useTranslations } from 'next-intl';

import { Label } from '@finnit/ui/components/ui/label';
import { Switch } from '@finnit/ui/components/ui/switch';

/** "Mostrar archivadas (2)": archived accounts are hidden by default. */
export function ShowArchivedToggle({
  checked,
  count,
  onChange,
}: {
  checked: boolean;
  count: number;
  onChange: (checked: boolean) => void;
}) {
  const t = useTranslations('accounts');
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="show-archived-accounts"
        checked={checked}
        onCheckedChange={onChange}
      />
      <Label
        htmlFor="show-archived-accounts"
        className="normal-case tracking-normal text-xs"
      >
        {t('showArchived', { count: String(count) })}
      </Label>
    </div>
  );
}
