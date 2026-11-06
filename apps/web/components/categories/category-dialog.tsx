'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { Input } from '@finnit/ui/components/ui/input';
import { Label } from '@finnit/ui/components/ui/label';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';
import { cn } from '@finnit/ui/lib/utils';

import { SelectField } from '@/components/recurring/select-field';
import {
  categoryErrorMessage,
  saveCategory,
  validateCategoryForm,
  type CategoryForm,
  type CategoryFormError,
} from '@/lib/categories/api';
import {
  CATEGORY_KINDS,
  CATEGORY_NAME_MAX,
  type SettingsCategory,
} from '@/lib/categories/types';
import { parentOptions } from '@/lib/categories/view';
import {
  ICON_COLORS,
  PICKABLE_ICON_KEYS,
  iconKeyForName,
  isIconKey,
} from '@/lib/finance/categories';
import { CATEGORY_ICONS } from '@/lib/finance/category-icons';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

const NO_PARENT = '';

/**
 * Create or edit one of the user's categories: name (any language, it is
 * translated), kind for a main category, the main category it hangs from
 * and its icon. Mounted while open.
 */
export function CategoryDialog({
  category,
  defaults,
  categories,
  onClose,
  onSaved,
}: {
  /** Null to create one. */
  category: SettingsCategory | null;
  /** Starting values for a new one (e.g. "Agregar subcategoría"). */
  defaults?: Partial<CategoryForm>;
  categories: ReadonlyArray<SettingsCategory>;
  onClose: () => void;
  onSaved: (created: boolean) => void;
}) {
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tf = useTranslations('categories.form');
  const [form, setForm] = React.useState<CategoryForm>(() =>
    category
      ? {
          name: category.name,
          kind: category.kind,
          parentId: category.parentId ?? NO_PARENT,
          icon: category.icon ?? '',
        }
      : {
          name: '',
          kind: 'expense',
          parentId: NO_PARENT,
          icon: '',
          ...defaults,
        },
  );
  const [error, setError] = React.useState<CategoryFormError | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const parent = categories.find((c) => c.id === form.parentId);
  const kind = parent?.kind ?? form.kind;
  // A category with subcategories stays a main category.
  const hasChildren = Boolean(
    category && categories.some((c) => c.parentId === category.id),
  );
  const parents = React.useMemo(
    () =>
      parentOptions(categories, kind, category?.id).map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [categories, kind, category?.id],
  );
  const shownIcon = isIconKey(form.icon)
    ? form.icon
    : iconKeyForName(form.name) !== 'other'
      ? iconKeyForName(form.name)
      : isIconKey(parent?.icon)
        ? parent.icon
        : 'other';

  function update(patch: Partial<CategoryForm>) {
    setForm((current) => ({ ...current, ...patch }));
    if ('name' in patch) setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateCategoryForm(form);
    setError(found);
    if (found) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await saveCategory({ ...form, kind }, category?.id ?? null, gql);
      exit.after(onSaved)(!category);
    } catch (e) {
      setSubmitError(categoryErrorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !saving && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={t('common.close')}
        className="sm:max-w-lg"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {category ? tf('editTitle') : tf('createTitle')}
            </DialogTitle>
            <DialogDescription>{tf('description')}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Input
              label={tf('name')}
              value={form.name}
              maxLength={CATEGORY_NAME_MAX}
              autoComplete="off"
              autoFocus
              placeholder={tf('namePlaceholder')}
              onChange={(e) => update({ name: e.target.value })}
              error={
                error === 'nameTooLong'
                  ? tf('errors.nameTooLong', { max: CATEGORY_NAME_MAX })
                  : error
                    ? tf(`errors.${error}`)
                    : undefined
              }
            />

            {form.parentId ? null : (
              <SelectField
                label={tf('kind')}
                value={form.kind}
                options={CATEGORY_KINDS.map((value) => ({
                  value,
                  label: tf(`kinds.${value}`),
                }))}
                onChange={(value) =>
                  update({ kind: value, parentId: NO_PARENT })
                }
                disabled={hasChildren}
              />
            )}

            {hasChildren ? null : (
              <div className="flex flex-col gap-1">
                <Combobox
                  label={tf('parent')}
                  options={parents}
                  value={form.parentId || undefined}
                  onChange={(value) => update({ parentId: value ?? NO_PARENT })}
                  placeholder={tf('noParent')}
                  searchPlaceholder={tf('searchParent')}
                  emptyText={tf('noParents')}
                  clearable
                />
                <p className="px-1 text-xs text-on-surface-variant">
                  {parent
                    ? tf('parentHint', { kind: tf(`kinds.${kind}`) })
                    : tf('mainHint')}
                </p>
              </div>
            )}

            <fieldset className="flex flex-col gap-2">
              <Label asChild className="px-1">
                <legend>{tf('icon')}</legend>
              </Label>
              <div
                role="radiogroup"
                aria-label={tf('icon')}
                className="grid grid-cols-6 gap-2 sm:grid-cols-9"
              >
                <IconChoice
                  label={tf('iconAuto')}
                  iconKey={shownIcon}
                  selected={!form.icon}
                  muted
                  onSelect={() => update({ icon: '' })}
                />
                {PICKABLE_ICON_KEYS.map((key) => (
                  <IconChoice
                    key={key}
                    label={tf(`icons.${key}`)}
                    iconKey={key}
                    selected={form.icon === key}
                    onSelect={() => update({ icon: key })}
                  />
                ))}
              </div>
            </fieldset>

            {submitError ? (
              <p role="alert" className="text-sm text-expense">
                {submitError}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? tf('saving') : tf('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IconChoice({
  label,
  iconKey,
  selected,
  muted = false,
  onSelect,
}: {
  label: string;
  iconKey: keyof typeof CATEGORY_ICONS;
  selected: boolean;
  /** "Automático": the icon it would get, faded. */
  muted?: boolean;
  onSelect: () => void;
}) {
  const Icon = CATEGORY_ICONS[iconKey];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={cn(
        'flex aspect-square items-center justify-center rounded-xl border outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected
          ? 'border-primary bg-primary/15'
          : 'border-outline hover:bg-accent',
      )}
    >
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-full text-white',
          muted && 'opacity-60',
        )}
        style={{ backgroundColor: ICON_COLORS[iconKey] }}
      >
        <Icon aria-hidden className="size-4" />
      </span>
    </button>
  );
}
