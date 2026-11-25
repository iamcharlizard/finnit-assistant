import { useTranslations } from 'use-intl';
import { ChevronRight } from 'lucide-react-native';

import type { AccountBalanceGroup } from '@finnit/core/accounts/balance-list';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Text } from '@finnit/ui-native/components/ui/text';
import { SyncPill } from '@finnit/ui-native/components/finance/sync-pill';

const tabular = { fontVariant: ['tabular-nums' as const] };

/**
 * Every account with what it has (a card: what it owes, how much of the
 * limit and when it is paid), grouped like the stack (the web's
 * AccountBalanceList). A tap opens the account.
 */
export function AccountBalanceList({
  groups,
  onSelect,
}: {
  groups: readonly AccountBalanceGroup[];
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('accounts.balanceList');
  return (
    <TwView className="gap-4">
      <Text accessibilityRole="header" weight="bold" className="px-1 text-base">
        {t('title')}
      </Text>
      {groups.map((group) => (
        <TwView key={group.key} className="gap-2">
          <Text
            weight="medium"
            className="px-1 text-[11px] uppercase tracking-[0.15em] text-on-surface-variant"
          >
            {group.title}
          </Text>
          {group.rows.map((row) => (
            <TwPressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={t('open', { name: row.label })}
              onPress={() => onSelect(row.id)}
              className={cn(
                'gap-2 rounded-[20px] border border-glass-border bg-surface p-4 active:opacity-80',
                row.archived && 'opacity-70',
              )}
            >
              <TwView className="flex-row items-start gap-3">
                <TwView className="min-w-0 flex-1">
                  <Text weight="medium" numberOfLines={1} className="text-sm">
                    {row.label}
                  </Text>
                  {row.detail || row.archived ? (
                    <Text
                      numberOfLines={1}
                      className="text-xs text-on-surface-variant"
                    >
                      {[row.detail, row.archived ? t('archived') : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}
                  <SyncPill sync={row.sync} className="mt-1.5" />
                </TwView>
                <TwView className="items-end">
                  <Text
                    weight="bold"
                    className={cn(
                      'text-base',
                      row.tone === 'expense'
                        ? 'text-expense'
                        : 'text-on-background',
                    )}
                    style={tabular}
                  >
                    {row.amount}
                  </Text>
                  <Text className="text-[11px] text-on-surface-variant">
                    {row.caption}
                  </Text>
                </TwView>
                <Icon
                  icon={ChevronRight}
                  size={16}
                  color="--on-surface-variant"
                />
              </TwView>
              {row.usedPercent != null ? (
                <Progress
                  value={row.usedPercent}
                  accessibilityLabel={row.creditLine ?? row.label}
                  indicatorColor={
                    row.usedPercent >= 90 ? 'var(--expense)' : undefined
                  }
                />
              ) : null}
              {row.creditLine || row.nextPayment ? (
                <TwView className="flex-row flex-wrap justify-between gap-x-3">
                  <Text className="text-xs text-on-surface-variant">
                    {row.creditLine ?? ''}
                  </Text>
                  <Text className="text-xs text-on-surface-variant">
                    {row.nextPayment ?? ''}
                  </Text>
                </TwView>
              ) : null}
            </TwPressable>
          ))}
        </TwView>
      ))}
    </TwView>
  );
}
