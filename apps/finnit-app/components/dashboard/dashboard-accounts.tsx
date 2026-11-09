import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import {
  ChevronRight,
  CreditCard,
  Landmark,
  PiggyBank,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';

import type {
  DashboardAccount,
  DashboardView,
} from '@finnit/core/dashboard/view';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';
import { useColor } from '@finnit/ui-native/theme/theme-root';

const ICONS: Record<DashboardAccount['type'], LucideIcon> = {
  debit: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Wallet,
  ewallet: Smartphone,
};

/** Each type's color when the account has none of its own (as on the web). */
const TYPE_COLORS: Record<DashboardAccount['type'], string> = {
  debit: 'var(--chart-1)',
  savings: 'var(--chart-3)',
  credit: 'var(--chart-2)',
  cash: 'var(--chart-4)',
  ewallet: 'var(--chart-5)',
};

/**
 * The accounts and their balances (those in the total first): a row opens
 * the account; the heading and "Ver todas" open Cuentas.
 */
export function DashboardAccounts({
  accounts,
  count,
}: {
  accounts: DashboardView['accounts'];
  count: number;
}) {
  const t = useTranslations('dashboard.accounts');
  const router = useRouter();
  const resolve = useColor();
  const openList = () => router.push('/accounts');
  return (
    <TwView className="rounded-card border border-outline-variant bg-surface p-2">
      <TwPressable
        accessibilityRole="link"
        accessibilityLabel={`${t('title')}, ${count > accounts.length ? t('seeAllCount', { count }) : t('seeAll')}`}
        onPress={openList}
        className="min-h-11 flex-row items-center justify-between px-3"
      >
        <Text
          accessibilityRole="header"
          weight="bold"
          className="text-base text-on-background"
        >
          {t('title')}
        </Text>
        <Text weight="medium" className="text-sm text-income">
          {count > accounts.length ? t('seeAllCount', { count }) : t('seeAll')}
        </Text>
      </TwPressable>
      {accounts.map((account) => {
        const Glyph = ICONS[account.type];
        const detail = [
          account.last4 ? `•••• ${account.last4}` : null,
          account.excluded ? t('excluded') : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <TwPressable
            key={account.id}
            accessibilityRole="button"
            accessibilityLabel={[account.name, detail, account.balance]
              .filter(Boolean)
              .join(', ')}
            onPress={() =>
              router.push({
                pathname: '/accounts/[accountId]',
                params: { accountId: account.id },
              })
            }
            className="min-h-14 flex-row items-center gap-3 rounded-2xl px-3 py-2 active:bg-accent"
          >
            <TwView
              className="size-10 items-center justify-center rounded-xl"
              style={{
                backgroundColor: resolve(
                  account.color ?? TYPE_COLORS[account.type],
                ),
              }}
            >
              <Glyph size={20} color="#ffffff" />
            </TwView>
            <TwView className="min-w-0 flex-1">
              <Text
                weight="medium"
                numberOfLines={1}
                className="text-sm text-on-background"
              >
                {account.name}
              </Text>
              {detail ? (
                <Text
                  numberOfLines={1}
                  className="text-xs text-on-surface-variant"
                >
                  {detail}
                </Text>
              ) : null}
            </TwView>
            <Text
              weight="bold"
              className="text-sm text-on-background"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {account.balance}
            </Text>
            <Icon icon={ChevronRight} size={16} color="--on-surface-variant" />
          </TwPressable>
        );
      })}
    </TwView>
  );
}
