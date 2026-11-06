import type * as React from 'react';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';

import { DISPLAY_NAME_MAX } from '@finnit/core/categorize/rename';
import type { TransactionRow } from '@finnit/core/finance/transactions';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import { SET_ALIAS_MUTATION } from '@finnit/core/transaction-detail/api';
import { CATEGORY_ICONS } from '@finnit/ui-native/lib/category-icons';
import { TransactionCard } from '@finnit/ui-native/components/finance/transaction-card';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { emitTransactionsChanged } from '@/lib/transactions/events';

/**
 * A movement in a list (history, Clasificar, account, dashboard), like the
 * web's TransactionListCard: the card opens its detail; the pencil renames
 * just this movement.
 */
export function TransactionListCard({
  row,
  category,
  time,
  showStatus = false,
  editable = true,
  rename,
  selectable,
  selected,
  onSelectedChange,
  selectLabel,
  footer,
  className,
}: {
  row: TransactionRow;
  category?: string;
  time?: string;
  showStatus?: boolean;
  editable?: boolean;
  rename?: (name: string) => Promise<void>;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
  selectLabel?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations();
  const l = useLocalizer();
  const router = useRouter();
  const gql = useGql();
  const pending = row.status === 'pending';

  return (
    <TransactionCard
      merchant={row.title}
      category={category ?? row.category}
      time={
        time ??
        (pending && !showStatus
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
      onOpen={() => router.push({ pathname: '/transaction/[id]', params: { id: row.id } })}
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
                  else await gql(SET_ALIAS_MUTATION, { id: row.id, input: { displayName: name.trim() || null } });
                  toast.success(t(name ? 'transaction.toasts.renamed' : 'transaction.toasts.nameRemoved'));
                  emitTransactionsChanged(row.id);
                } catch (error) {
                  toast.error(requestErrorMessage(error, l.t));
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
