import * as React from 'react';
import { useTranslations } from 'use-intl';

import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Checkbox } from '@finnit/ui-native/components/ui/checkbox';
import { Select, type SelectOption } from '@finnit/ui-native/components/ui/select';
import { Text } from '@finnit/ui-native/components/ui/text';

/**
 * The bar while movements are selected: "Mover a…" a category, with
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
  categories: SelectOption<string>[];
  busy: boolean;
  onMove: (categoryId: string, remember: boolean) => void;
  onClear: () => void;
}) {
  const t = useTranslations('categorize');
  const tc = useTranslations('common');
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [remember, setRemember] = React.useState(true);
  return (
    <TwView accessibilityLabel={t('actionsLabel')} className="gap-3 rounded-card border border-outline bg-surface-95 p-3" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
      <TwView className="flex-row items-center justify-between gap-2">
        <Text weight="medium" accessibilityLiveRegion="polite" className="text-sm">
          {t('selected', { count })}
        </Text>
        <Button variant="ghost" size="sm" label={t('clearSelection')} onPress={onClear} />
      </TwView>
      <Select
        value={categoryId}
        options={categories}
        onValueChange={setCategoryId}
        placeholder={t('moveTo')}
        title={t('moveTo')}
        searchable
        searchPlaceholder={t('searchCategory')}
        emptyLabel={t('noCategories')}
        closeLabel={tc('close')}
      />
      <Checkbox checked={remember} onCheckedChange={setRemember} label={t('remember')} />
      <Button
        label={busy ? t('applying') : t('apply')}
        disabled={!categoryId || busy}
        onPress={() => categoryId && onMove(categoryId, remember)}
        className="w-full"
      />
    </TwView>
  );
}
