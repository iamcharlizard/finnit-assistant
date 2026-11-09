import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { Percent, Wallet } from 'lucide-react-native';

import type {
  CardPeriodTone,
  CardPeriodView,
} from '@finnit/core/accounts/card-period';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Text } from '@finnit/ui-native/components/ui/text';

import { TextLink } from '@/components/finance/text-link';

const BADGE: Record<
  CardPeriodTone,
  'muted' | 'highlight' | 'success' | 'expense'
> = {
  neutral: 'muted',
  warning: 'highlight',
  success: 'success',
  danger: 'expense',
};

/**
 * A credit card's billing cycle (the web's CardPeriodSummary): status, what
 * to pay and by when, the figures and "Pagar tarjeta" / "Registrar
 * intereses", which open Nuevo movimiento filled in.
 */
export function CardPeriodSummary({
  period,
  compact = false,
}: {
  period: CardPeriodView;
  compact?: boolean;
}) {
  const t = useTranslations('cards.period');
  const router = useRouter();
  const { pay, interest } = period;
  const figures = [
    { label: period.balanceLabel, value: period.balance },
    ...(period.status === 'open'
      ? []
      : [
          { label: t('noInterest'), value: period.noInterestPayment },
          { label: t('paid'), value: period.paid },
          { label: t('remaining'), value: period.remaining },
        ]),
    ...(period.minimumPayment
      ? [{ label: t('minimum'), value: period.minimumPayment }]
      : []),
  ];

  return (
    <TwView className="gap-3 rounded-2xl border border-glass-border bg-surface p-3.5">
      <TwView className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-xs text-on-surface-variant">
          {t('cycle', { range: period.range })}
        </Text>
        <Badge label={period.statusLabel} variant={BADGE[period.tone]} />
      </TwView>
      <Text weight="medium" className="text-sm">
        {period.headline}
      </Text>
      {period.progress != null ? (
        <Progress
          value={period.progress}
          accessibilityLabel={t('progress', { percent: period.progress })}
        />
      ) : null}
      {!compact ? (
        <TwView className="flex-row flex-wrap gap-y-2">
          {figures.map((f) => (
            <TwView key={f.label} className="w-1/2 pr-2">
              <Text className="text-xs text-on-surface-variant">{f.label}</Text>
              <Text weight="bold" className="text-sm">
                {f.value}
              </Text>
            </TwView>
          ))}
        </TwView>
      ) : null}
      {period.split ? (
        <TwView className="gap-2 rounded-2xl bg-track p-3">
          <TwView className="flex-row gap-2">
            {[
              { label: t('cash'), value: period.split.cash },
              {
                label: t('installmentsInCycle'),
                value: period.split.installments,
              },
              { label: t('installmentBalance'), value: period.split.balance },
            ].map((f) => (
              <TwView key={f.label} className="flex-1">
                <Text className="text-xs text-on-surface-variant">
                  {f.label}
                </Text>
                <Text weight="bold" className="text-sm">
                  {f.value}
                </Text>
              </TwView>
            ))}
          </TwView>
          {!compact
            ? period.split.plans.map((plan) => (
                <TwView
                  key={`${plan.debtId}:${plan.label}`}
                  className="flex-row items-baseline justify-between gap-2"
                >
                  <TextLink
                    label={plan.label}
                    onPress={() =>
                      router.push({
                        pathname: '/planning/debts/[id]',
                        params: { id: plan.debtId },
                      })
                    }
                  />
                  <Text className="text-xs text-on-surface-variant">
                    {plan.amount}
                    {plan.left ? ` · ${plan.left}` : ''}
                  </Text>
                </TwView>
              ))
            : null}
        </TwView>
      ) : null}
      {!compact && period.pendingInstallments ? (
        <Text className="text-xs text-on-surface-variant">
          {t('pendingInstallments', { amount: period.pendingInstallments })}
        </Text>
      ) : null}
      {!compact && period.fromStatement ? (
        <Text className="text-xs text-on-surface-variant">
          {t('fromStatement')}
        </Text>
      ) : null}
      {interest ? (
        <Text className="text-xs text-on-surface-variant">
          {interest.estimate
            ? t('interestHint', { amount: interest.estimate })
            : t('interestNoRate')}
        </Text>
      ) : null}
      <TwView className="flex-row flex-wrap items-center gap-2">
        {pay ? (
          <Button
            size="sm"
            icon={Wallet}
            label={t('pay')}
            onPress={() =>
              router.push({
                pathname: '/new-entry',
                params: {
                  action: 'transfer',
                  to: pay.accountId,
                  amount: pay.amount,
                  due: pay.dueDate,
                },
              })
            }
          />
        ) : null}
        {interest ? (
          <Button
            size="sm"
            variant="outline"
            icon={Percent}
            label={t('recordInterest')}
            onPress={() =>
              router.push({
                pathname: '/new-entry',
                params: {
                  action: 'expense',
                  account: interest.accountId,
                  amount: interest.amount,
                  merchant: t('interestName'),
                  ...(interest.categoryId
                    ? { category: interest.categoryId }
                    : {}),
                },
              })
            }
          />
        ) : null}
        {!compact ? (
          <TextLink href={period.historyHref} label={t('movements')} />
        ) : null}
      </TwView>
    </TwView>
  );
}
