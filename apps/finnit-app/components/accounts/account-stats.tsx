import { useTranslations } from 'use-intl';
import { CalendarCheck, CreditCard, FileText, Gauge, Scissors, TrendingUp, Wallet, type LucideIcon } from 'lucide-react-native';

import type { AccountDetail, DateFact } from '@finnit/core/accounts/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

import { AccountStat } from './account-stat';

/** The selected account in figures (the web's AccountStats + AccountFacts). */
export function AccountStats({ detail }: { detail: AccountDetail }) {
  const t = useTranslations('accounts.detail');
  const { account, projection } = detail;
  const credit = account.credit;
  const projectedHint =
    projection.pendingCount === 0
      ? t('projectedNone')
      : t(credit ? 'projectedCredit' : 'projectedDebit', { count: projection.pendingCount, amount: projection.pendingTotal });
  const projected = (
    <AccountStat icon={TrendingUp} label={t('projected')} value={projection.amount} hint={projectedHint} tone={projection.short ? 'expense' : 'default'} />
  );
  const dateStat = (label: string, icon: LucideIcon, fact: DateFact | null) => (
    <AccountStat icon={icon} label={label} value={fact?.date ?? t('notSet')} hint={fact?.relative ?? t('notSetHint')} muted={!fact} />
  );

  if (!credit) {
    return (
      <TwView className="gap-3">
        <AccountStat icon={Wallet} label={t('balance')} value={account.balance} tone={account.amount < 0 ? 'expense' : 'default'} />
        {projected}
      </TwView>
    );
  }
  return (
    <TwView className="gap-3">
      <AccountStat
        icon={Gauge}
        label={t('limit')}
        value={detail.limit ?? t('noLimit')}
        hint={credit.available ? t('available', { amount: credit.available }) : undefined}
        muted={!detail.limit}
      />
      <AccountStat
        icon={CreditCard}
        label={t('used')}
        value={account.balance}
        tone={credit.owed > 0 ? 'expense' : 'default'}
        progress={detail.usedPercent}
        hint={detail.usedPercent != null ? t('usedHint', { percent: detail.usedPercent }) : undefined}
      />
      {projected}
      {dateStat(t('statementDate'), Scissors, detail.statementDate)}
      {dateStat(t('paymentDate'), CalendarCheck, detail.paymentDate)}
      {detail.facts.length > 0 ? (
        <Card className="gap-2.5 rounded-[20px] p-[18px]">
          <TwView className="flex-row items-center gap-2">
            <Icon icon={FileText} size={16} color="--brand-ink" />
            <Text weight="medium" className="text-[11px] uppercase tracking-[0.15em] text-on-surface-variant">
              {t('statement')}
            </Text>
          </TwView>
          {detail.facts.map((fact) => (
            <TwView key={fact.label} className="flex-row justify-between gap-3">
              <Text className="text-sm text-on-surface-variant">{fact.label}</Text>
              <Text weight="medium" className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
                {fact.value}
              </Text>
            </TwView>
          ))}
        </Card>
      ) : null}
    </TwView>
  );
}
