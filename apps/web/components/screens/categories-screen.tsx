'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  EllipsisVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';
import { Switch } from '@finnit/ui/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@finnit/ui/components/ui/tabs';
import { toast } from '@finnit/ui/components/ui/toaster';
import { cn } from '@finnit/ui/lib/utils';

import { CategoryDialog } from '@/components/categories/category-dialog';
import { DeleteCategoryDialog } from '@/components/categories/delete-category-dialog';
import { PageHeader } from '@/components/page-header';
import {
  HIDE_CATEGORY_MUTATION,
  SHOW_CATEGORY_MUTATION,
  categoryErrorMessage,
  type CategoryForm,
} from '@/lib/categories/api';
import type { CategoriesData } from '@/lib/categories/load';
import {
  CATEGORY_KINDS,
  type CategoryKind,
  type SettingsCategory,
} from '@finnit/core/categories/types';
import {
  categoryTree,
  type CategoryGroup,
  type CategoryRow,
} from '@finnit/core/categories/view';
import { ICON_COLORS } from '@finnit/core/finance/categories';
import { CATEGORY_ICONS } from '@/lib/finance/category-icons';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

type Editing = {
  category: SettingsCategory | null;
  defaults?: Partial<CategoryForm>;
} | null;

/**
 * Configuración → Categorías: the shared catalog (read-only; each one can
 * be hidden from the pickers) and the user's own categories, which they
 * create, edit and delete. Spending and income in separate tabs.
 */
export function CategoriesScreen({ data }: { data: CategoriesData }) {
  const t = useTranslations('categories');
  const { t: translate, locale } = useLocalizer();
  const router = useRouter();
  const [tab, setTab] = React.useState<CategoryKind>('expense');
  const [editing, setEditing] = React.useState<Editing>(null);
  const [deleting, setDeleting] = React.useState<SettingsCategory | null>(null);
  const [open, setOpen] = React.useState<ReadonlySet<string>>(new Set());
  const [pending, startTransition] = React.useTransition();
  // The switch flips at once; the server's list replaces it after the refresh.
  const [categories, setOptimisticHidden] = React.useOptimistic(
    data.categories,
    (list, change: { ids: string[]; hidden: boolean }) =>
      list.map((c) =>
        change.ids.includes(c.id) ? { ...c, hidden: change.hidden } : c,
      ),
  );
  const byId = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const trees = React.useMemo(
    () =>
      Object.fromEntries(
        CATEGORY_KINDS.map((kind) => [
          kind,
          categoryTree(categories, kind, data.usage, locale),
        ]),
      ) as Record<CategoryKind, CategoryGroup[]>,
    [categories, data.usage, locale],
  );

  const toggleOpen = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function setHidden(row: CategoryRow, hidden: boolean) {
    // A main category hides with its subcategories; showing a subcategory
    // shows its main category too.
    const ids = [
      row.id,
      ...categories.filter((c) => c.parentId === row.id).map((c) => c.id),
      ...(!hidden && row.parentId ? [row.parentId] : []),
    ];
    startTransition(async () => {
      setOptimisticHidden({ ids, hidden });
      try {
        await gql(hidden ? HIDE_CATEGORY_MUTATION : SHOW_CATEGORY_MUTATION, {
          id: row.id,
        });
        router.refresh();
      } catch (error) {
        toast.error(categoryErrorMessage(error, translate));
      }
    });
  }

  const actions = (row: CategoryRow) => {
    const category = byId.get(row.id);
    if (!category) return null;
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Switch
          checked={!row.hidden}
          onCheckedChange={(shown) => setHidden(row, !shown)}
          disabled={pending}
          aria-label={t(row.hidden ? 'showOne' : 'hideOne', {
            name: row.name,
          })}
        />
        {row.editable ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('actions', { name: row.name })}
              >
                <EllipsisVertical aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing({ category })}>
                <Pencil aria-hidden /> {t('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setDeleting(category)}
                className="text-expense"
              >
                <Trash2 aria-hidden className="text-expense!" /> {t('remove')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          // Keeps the switches lined up with the rows that have a menu.
          <span aria-hidden className="size-11" />
        )}
      </div>
    );
  };

  const label = (row: CategoryRow, main: boolean) => {
    const Icon = CATEGORY_ICONS[row.iconKey];
    return (
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3',
          row.hidden && 'opacity-50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full text-white',
            main ? 'size-10' : 'size-8',
          )}
          style={{ backgroundColor: ICON_COLORS[row.iconKey] }}
        >
          <Icon className={main ? 'size-5' : 'size-4'} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'truncate text-on-background',
                main ? 'font-semibold' : 'text-sm',
              )}
            >
              {row.name}
            </span>
            {row.isDefault ? null : (
              <Badge variant="highlight">{t('own')}</Badge>
            )}
          </span>
          <span className="text-xs text-on-surface-variant">
            {row.hidden
              ? t('hiddenHint')
              : t('thisMonth', { count: row.count })}
          </span>
        </span>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        back={{ href: '/settings', label: t('back') }}
        actions={
          <Button
            size="sm"
            onClick={() =>
              setEditing({ category: null, defaults: { kind: tab } })
            }
          >
            <Plus aria-hidden /> {t('create')}
          </Button>
        }
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as CategoryKind)}>
          <TabsList>
            {CATEGORY_KINDS.map((kind) => (
              <TabsTrigger key={kind} value={kind}>
                {t(`tabs.${kind}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {CATEGORY_KINDS.map((kind) => (
            <TabsContent key={kind} value={kind} className="mt-4">
              <ul className="flex flex-col gap-3">
                {trees[kind].map((group) => {
                  const isOpen = open.has(group.id);
                  const panelId = `category-${group.id}`;
                  return (
                    <li
                      key={group.id}
                      className="rounded-card border border-glass-border bg-surface/70 shadow-elevation"
                    >
                      <div className="flex items-center gap-2 py-2 pr-2 pl-3">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() => toggleOpen(group.id)}
                          className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          {label(group, true)}
                          <span className="hidden text-xs text-on-surface-variant sm:inline">
                            {t('subcategories', {
                              count: group.children.length,
                            })}
                          </span>
                          <ChevronDown
                            aria-hidden
                            className={cn(
                              'size-4 shrink-0 text-on-surface-variant transition-transform',
                              isOpen && 'rotate-180',
                            )}
                          />
                        </button>
                        {actions(group)}
                      </div>
                      {isOpen ? (
                        <div
                          id={panelId}
                          className="flex flex-col gap-1 border-t border-outline/60 px-3 pt-2 pb-3"
                        >
                          {group.children.map((child) => (
                            <div
                              key={child.id}
                              className="flex items-center gap-2 rounded-xl py-1 pl-6"
                            >
                              {label(child, false)}
                              {actions(child)}
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 self-start"
                            onClick={() =>
                              setEditing({
                                category: null,
                                defaults: { kind, parentId: group.id },
                              })
                            }
                          >
                            <Plus aria-hidden />
                            {t('addSubcategory', { name: group.name })}
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {editing ? (
        <CategoryDialog
          category={editing.category}
          defaults={editing.defaults}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            toast.success(t(created ? 'toasts.created' : 'toasts.saved'));
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteCategoryDialog
          category={deleting}
          categories={categories}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            toast.success(t('toasts.deleted'));
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
    </div>
  );
}
