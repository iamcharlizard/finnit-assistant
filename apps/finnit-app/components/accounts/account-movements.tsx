import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { ArrowRight, Inbox } from 'lucide-react-native';

import type { TransactionRow } from '@finnit/core/finance/transactions';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Card } from '@finnit/ui-native/components/ui/card';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

import { TransactionListCard } from '@/components/finance/transaction-card';
import { appHref } from '@/lib/nav/app-href';

/** The account's (or all accounts') latest movements, with "Ver todos". */
export function AccountMovements({ rows, historyHref }: { rows: TransactionRow[]; historyHref: string }) {
  const t = useTranslations('accounts.detail');
  const tc = useTranslations('cards');
  const router = useRouter();
  return (
    <Card className="gap-0 overflow-hidden rounded-[20px] p-0">
      <TwView className="flex-row items-center justify-between gap-3 border-b border-glass-border px-[18px] py-3">
        <Text accessibilityRole="header" weight="bold" className="text-sm">
          {t('movements')}
        </Text>
        {rows.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            label={t('seeAll')}
            trailing={<Icon icon={ArrowRight} size={14} color="--brand-ink" />}
            onPress={() => router.navigate(appHref(historyHref))}
          />
        ) : null}
      </TwView>
      {rows.length > 0 ? (
        <TwView className="gap-2 p-3">
          {rows.map((row) => (
            <TransactionListCard key={row.id} row={row} />
          ))}
        </TwView>
      ) : (
        <EmptyState icon={Inbox} title={tc('noMovementsTitle')} description={tc('noMovementsDescription')} className="m-3" />
      )}
    </Card>
  );
}
