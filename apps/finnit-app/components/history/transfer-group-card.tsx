import * as React from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, Trash2, type LucideIcon } from 'lucide-react-native';

import { deleteTransfer, transactionErrorMessage } from '@finnit/core/transaction-detail/api';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import type { HistoryRow, TransferGroup } from '@finnit/core/history/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { emitTransactionsChanged } from '@/lib/transactions/events';

/** Both sides of a transfer as one movement, each side below opening its own detail (the web's TransferGroupCard). */
export function TransferGroupCard({ group }: { group: TransferGroup }) {
  const t = useTranslations();
  const l = useLocalizer();
  const gql = useGql();
  const [deleting, setDeleting] = React.useState(false);

  function askDelete() {
    Alert.alert(t('history.deleteTransferTitle'), t('history.deleteTransferDescription'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('history.deleteTransfer'),
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          deleteTransfer(group.transferId, gql)
            .then(() => {
              toast.success(t('history.transferDeleted'));
              emitTransactionsChanged(null);
            })
            .catch((e: unknown) => toast.error(transactionErrorMessage(e, l.t)))
            .finally(() => setDeleting(false));
        },
      },
    ]);
  }
  const status = group.status === 'cancelled' ? t('finance.cancelled') : group.status === 'pending' ? t('finance.pending') : group.status === 'inProcess' ? t('finance.inProcess') : t('finance.completed');
  return (
    <TwView accessibilityLabel={`${group.title}: ${group.route}`} className="rounded-2xl bg-surface">
      <TwView className="min-h-11 flex-row items-center gap-3 p-4 pb-2">
        <TwView className="size-12 items-center justify-center rounded-chip bg-track">
          <Icon icon={ArrowLeftRight} size={22} color="--on-surface-variant" />
        </TwView>
        <TwView className="min-w-0 flex-1">
          <Text weight="medium" numberOfLines={1} className="text-sm">
            {group.title}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-xs text-on-surface-variant">
            {group.route}
          </Text>
        </TwView>
        <TwView className="ml-2 items-end">
          <Text weight="bold" className="text-sm">
            {group.amount}
          </Text>
          <Text className={cn('mt-0.5 text-[11px]', group.status === 'completed' ? 'text-income' : 'text-on-surface-variant')}>{status}</Text>
        </TwView>
        <TwPressable
          accessibilityRole="button"
          accessibilityLabel={t('history.deleteTransfer')}
          disabled={deleting}
          hitSlop={6}
          onPress={askDelete}
          className={cn('size-9 items-center justify-center rounded-full active:bg-accent', deleting && 'opacity-40')}
        >
          <Icon icon={Trash2} size={16} color="--on-surface-variant" />
        </TwPressable>
      </TwView>
      <TwView className="ml-10 border-l border-outline pb-2 pr-2">
        <SideRow icon={ArrowUpRight} label={group.outLabel} row={group.out} />
        <SideRow icon={ArrowDownLeft} label={group.inLabel} row={group.in} />
      </TwView>
    </TwView>
  );
}

function SideRow({ icon, label, row }: { icon: LucideIcon; label: string; row: HistoryRow }) {
  const t = useTranslations();
  const router = useRouter();
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityLabel={t('transaction.openDetail', { name: label })}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: row.id } })}
      className="min-h-11 flex-row items-center gap-2 rounded-xl px-3 active:bg-accent"
    >
      <Icon icon={icon} size={16} color="--on-surface-variant" />
      <TwView className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[13px]">
          {label}
        </Text>
        {row.title && row.title !== label ? (
          <Text numberOfLines={1} className="text-[11px] text-on-surface-variant">
            {row.title}
          </Text>
        ) : null}
      </TwView>
      <Text weight="medium" className={cn('text-[13px]', row.variant === 'income' ? 'text-income' : 'text-on-surface-variant')} style={{ fontVariant: ['tabular-nums'] }}>
        {row.amount}
      </Text>
      <Icon icon={ChevronRight} size={16} color="--on-surface-variant" />
    </TwPressable>
  );
}
