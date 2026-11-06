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
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import {
  DELETE_CATEGORY_MUTATION,
  categoryErrorMessage,
  categoryReferences,
} from '@finnit/core/categories/api';
import type { SettingsCategory } from '@finnit/core/categories/types';
import {
  isInUse,
  moveTargets,
  type CategoryReferences,
} from '@finnit/core/categories/view';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { categoryOptions } from '@finnit/core/new-entry/options';

/**
 * Deletes one of the user's categories. When something uses it (movements,
 * budgets, rules, subcategories…), it asks where to move all of it first.
 */
export function DeleteCategoryDialog({
  category,
  categories,
  onClose,
  onDeleted,
}: {
  category: SettingsCategory;
  categories: ReadonlyArray<SettingsCategory>;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const exit = useDialogExit();
  const { t, locale } = useLocalizer();
  const td = useTranslations('categories.delete');
  const [refs, setRefs] = React.useState<CategoryReferences | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [moveTo, setMoveTo] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    categoryReferences(category.id, gql)
      .then((found) => live && setRefs(found))
      .catch((e: unknown) => live && setLoadError(categoryErrorMessage(e, t)));
    return () => {
      live = false;
    };
  }, [category.id, t]);

  const targets = React.useMemo(
    () =>
      categoryOptions(moveTargets(categories, category), category.kind, locale),
    [categories, category, locale],
  );
  const inUse = refs ? isInUse(refs) : false;
  const ready = refs !== null && (!inUse || Boolean(moveTo));

  async function confirm() {
    setDeleting(true);
    setError(null);
    try {
      await gql(DELETE_CATEGORY_MUTATION, {
        id: category.id,
        moveToId: inUse ? moveTo : null,
      });
      exit.after(onDeleted)();
    } catch (e) {
      setError(categoryErrorMessage(e, t));
      setDeleting(false);
    }
  }

  const uses = refs
    ? (
        [
          ['transactions', refs.transactions],
          ['children', refs.children],
          ['budgetCaps', refs.budgetCaps],
          ['rules', refs.rules + refs.aliases],
          ['recurring', refs.recurring],
        ] as const
      ).filter(([, n]) => n > 0)
    : [];

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !deleting && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={t('common.close')}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{td('title', { name: category.name })}</DialogTitle>
          <DialogDescription>
            {refs === null && !loadError
              ? t('common.loading')
              : inUse
                ? td('inUse')
                : td('notInUse')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {loadError ? (
            <p role="alert" className="text-sm text-expense">
              {loadError}
            </p>
          ) : null}
          {uses.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-on-background">
              {uses.map(([kind, count]) => (
                <li key={kind}>· {td(`uses.${kind}`, { count })}</li>
              ))}
            </ul>
          ) : null}
          {inUse ? (
            <Combobox
              label={td('moveTo')}
              options={targets}
              value={moveTo}
              onChange={setMoveTo}
              placeholder={td('moveToPlaceholder')}
              searchPlaceholder={td('search')}
              emptyText={td('noTargets')}
            />
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-expense">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={deleting}>
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={!ready || deleting}
            onClick={confirm}
          >
            {deleting
              ? td('deleting')
              : inUse
                ? td('moveAndDelete')
                : td('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
