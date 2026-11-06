import * as React from 'react';
import { useTranslations } from 'use-intl';

import { categoryErrorMessage, HIDE_CATEGORY_MUTATION, SHOW_CATEGORY_MUTATION } from '@finnit/core/categories/api';
import { CATEGORIES_QUERY, categoriesData, categoriesVariables, type CategoriesResult } from '@finnit/core/categories/request';
import type { CategoryKind } from '@finnit/core/categories/types';
import { categoryTree, type CategoryRow } from '@finnit/core/categories/view';
import { ICON_COLORS } from '@finnit/core/finance/categories';
import { todayKey } from '@finnit/core/finance/dates';
import { CATEGORY_ICONS } from '@finnit/ui-native/lib/category-icons';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { Screen } from '@/components/shell/screen';
import { useGql } from '@/lib/graphql/runner';
import { useView } from '@/lib/graphql/use-view';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/** Configuración → Categorías: the catalog and the user's own, by kind; hide or show each. */
export function CategoriesScreen() {
  const t = useTranslations('categories');
  const l = useLocalizer();
  const gql = useGql();
  const [kind, setKind] = React.useState<CategoryKind>('expense');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const { view, loading, error, refreshing, refresh } = useView({
    query: CATEGORIES_QUERY,
    variables: categoriesVariables(todayKey()),
    build: (data: CategoriesResult) => categoriesData(data),
  });
  const groups = React.useMemo(() => (view ? categoryTree(view.categories, kind, view.usage, l.locale) : []), [view, kind, l.locale]);

  async function setHidden(row: CategoryRow, hidden: boolean) {
    setBusyId(row.id);
    try {
      await gql(hidden ? HIDE_CATEGORY_MUTATION : SHOW_CATEGORY_MUTATION, { id: row.id });
      refresh();
    } catch (e) {
      toast.error(categoryErrorMessage(e, l.t));
    } finally {
      setBusyId(null);
    }
  }

  const row = (item: CategoryRow, main: boolean) => {
    const Glyph = CATEGORY_ICONS[item.iconKey];
    return (
      <TwView key={item.id} className={cn('min-h-14 flex-row items-center gap-3', !main && 'pl-8')}>
        <TwView className={cn('min-w-0 flex-1 flex-row items-center gap-3', item.hidden && 'opacity-50')}>
          <TwView
            className={cn('shrink-0 items-center justify-center rounded-full', main ? 'size-10' : 'size-8')}
            style={{ backgroundColor: ICON_COLORS[item.iconKey] }}
          >
            <Glyph size={main ? 20 : 16} color="#ffffff" />
          </TwView>
          <TwView className="min-w-0 flex-1">
            <TwView className="flex-row items-center gap-2">
              <Text weight={main ? 'bold' : 'regular'} numberOfLines={1} className={cn('shrink', main ? 'text-base' : 'text-sm')}>
                {item.name}
              </Text>
              {item.isDefault ? null : <Badge variant="highlight" label={t('own')} />}
            </TwView>
            <Text className="text-xs text-on-surface-variant">{item.hidden ? t('hiddenHint') : t('thisMonth', { count: item.count })}</Text>
          </TwView>
        </TwView>
        <Switch
          checked={!item.hidden}
          disabled={busyId === item.id}
          onCheckedChange={(shown) => void setHidden(item, !shown)}
          accessibilityLabel={t(item.hidden ? 'showOne' : 'hideOne', { name: item.name })}
        />
      </TwView>
    );
  };

  return (
    <Screen title={t('title')} subtitle={t('subtitle')} back withBottomNav={false} loading={loading} error={error} refreshing={refreshing} onRefresh={refresh}>
      <TwView className="gap-4">
        <Segmented
          accessibilityLabel={t('title')}
          options={[
            { value: 'expense', label: t('tabs.expense') },
            { value: 'income', label: t('tabs.income') },
          ]}
          value={kind}
          onValueChange={(next) => setKind(next as CategoryKind)}
        />
        {groups.map((group) => (
          <TwView key={group.id} className="rounded-card border border-glass-border bg-glass px-4 py-2">
            {row(group, true)}
            {group.children.map((child) => row(child, false))}
          </TwView>
        ))}
      </TwView>
    </Screen>
  );
}
