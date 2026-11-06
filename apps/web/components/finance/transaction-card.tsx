'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { TransactionCard as Card } from '@finnit/ui/components/finance/transaction-card';
import { toast } from '@finnit/ui/components/ui/toaster';

import { useTransactionDrawer } from '@/components/transaction-detail/transaction-drawer';
import { DISPLAY_NAME_MAX } from '@/lib/categorize/rename';
import { CATEGORY_ICONS } from '@/lib/finance/category-icons';
import type { TransactionRow } from '@/lib/finance/transactions';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { SET_ALIAS_MUTATION } from '@/lib/transaction-detail/api';

/** Sets (or, with "", removes) a movement's own name; nothing else changes. */
export async function saveOwnName(id: string, name: string): Promise<void> {
  await gql(SET_ALIAS_MUTATION, {
    id,
    input: { displayName: name.trim() || null },
  });
}

/**
 * A movement in a list (history, Clasificar, account, dashboard): the whole
 * card opens its detail (drawer, or modal on small screens); the pencil by
 * the name edits this movement's own name right there (rules live in the
 * detail). `footer` goes inside the card (e.g. a category suggestion).
 */
export function TransactionListCard({
  row,
  category,
  time,
  showStatus = false,
  editable = true,
  onRenamed,
  onDetailChange,
  rename,
  selectable,
  selected,
  onSelectedChange,
  selectLabel,
  footer,
  className,
}: {
  row: TransactionRow;
  /** Overrides the row's category text. */
  category?: string;
  /** Overrides the row's time text. */
  time?: string;
  /** "Completado / Pendiente / En proceso" under the amount (history). */
  showStatus?: boolean;
  editable?: boolean;
  /** After the own name changed (reload the list). */
  onRenamed?: () => void;
  /** After the movement changed in its detail (for lists kept on the client). */
  onDetailChange?: () => void;
  /** Saves the own name some other way (e.g. merging the updated row). */
  rename?: (name: string) => Promise<void>;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
  selectLabel?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations();
  const { t: translate } = useLocalizer();
  const drawer = useTransactionDrawer();
  const pending = row.status === 'pending';

  return (
    <Card
      merchant={row.title}
      category={category ?? row.category}
      time={
        time ??
        (row.status === 'pending' && !showStatus
          ? t('finance.withPending', { time: row.time })
          : row.status === 'inProcess' && !showStatus
            ? t('finance.withInProcess', { time: row.time })
            : row.time)
      }
      amount={row.amount}
      icon={CATEGORY_ICONS[row.iconKey]}
      variant={pending || row.variant === 'neutral' ? 'pending' : row.variant}
      status={
        showStatus
          ? pending
            ? { label: t('finance.pending'), variant: 'pendiente' }
            : row.status === 'inProcess'
              ? { label: t('finance.inProcess'), variant: 'info' }
              : { label: t('finance.completed'), variant: 'completado' }
          : undefined
      }
      isPrivate={row.isPrivate}
      privateLabel={t('finance.private')}
      onOpen={() => drawer.open(row.id, { onChange: onDetailChange })}
      openLabel={t('transaction.openDetail', { name: row.title })}
      selectable={selectable}
      selected={selected}
      onSelectedChange={onSelectedChange}
      selectLabel={selectLabel}
      rename={
        editable
          ? {
              editLabel: t('transaction.editName', { name: row.title }),
              inputLabel: t('transaction.nameInput'),
              maxLength: DISPLAY_NAME_MAX,
              onSave: async (name) => {
                try {
                  if (rename) await rename(name);
                  else await saveOwnName(row.id, name);
                  toast.success(
                    t(
                      name
                        ? 'transaction.toasts.renamed'
                        : 'transaction.toasts.nameRemoved',
                    ),
                  );
                  onRenamed?.();
                } catch (error) {
                  toast.error(requestErrorMessage(error, translate));
                  throw error;
                }
              },
            }
          : undefined
      }
      footer={footer}
      className={className}
    />
  );
}
