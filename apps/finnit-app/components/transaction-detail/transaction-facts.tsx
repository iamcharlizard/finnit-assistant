import { useRouter, type Href } from 'expo-router';
import { useTranslations } from 'use-intl';
import { Link2 } from 'lucide-react-native';

import type { TransactionDetailView } from '@finnit/core/transaction-detail/view';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

interface Fact {
  label: string;
  value: string;
  href?: string;
  transactionId?: string;
}

/** Account, category, source, status, the transfer's other side, recurring payment and notes. */
export function TransactionFacts({
  view,
  merchant,
  description,
}: {
  view: TransactionDetailView;
  merchant: string;
  description: string;
}) {
  const t = useTranslations('transaction');
  const tf = useTranslations('finance');
  const router = useRouter();
  const facts: Fact[] = [
    { label: t('fields.account'), value: view.accountLabel },
    ...(view.categoryLabel ? [{ label: t('fields.category'), value: view.categoryLabel }] : []),
    { label: t('fields.source'), value: t(`sources.${view.sourceKind}`) },
    {
      label: t('fields.status'),
      value: view.pending ? tf('pending') : view.inProcess ? tf('inProcess') : tf('completed'),
    },
    ...(view.counterpart
      ? [{ label: t('fields.transfer'), value: view.counterpart.label, transactionId: view.counterpart.transactionId }]
      : []),
    ...(view.recurring ? [{ label: t('fields.recurring'), value: view.recurring.label, href: view.recurring.href }] : []),
    ...(!view.isPrivate && merchant ? [{ label: t('fields.merchant'), value: merchant }] : []),
    ...(!view.isPrivate && description && description !== merchant && !/^Transfer to .+/i.test(description)
      ? [{ label: t('fields.description'), value: description }]
      : []),
    ...(!view.isPrivate && view.original && view.original !== merchant
      ? [{ label: t('fields.original'), value: view.original }]
      : []),
    ...(view.notes ? [{ label: t('fields.notes'), value: view.notes }] : []),
  ];
  return (
    <Card className="gap-1 rounded-[20px] p-5">
      <Text weight="medium" className="mb-2 text-[11px] uppercase tracking-[0.15em] text-on-surface-variant">
        {t('detailsTitle')}
      </Text>
      {facts.map((fact, index) => {
        const link = fact.transactionId
          ? () => router.push({ pathname: '/transaction/[id]', params: { id: fact.transactionId! } })
          : fact.href
            ? () => router.push(fact.href as Href)
            : null;
        return (
          <TwView key={fact.label} className={cn('gap-0.5 py-2.5', index > 0 && 'border-t border-glass-border')}>
            <Text className="text-sm text-on-surface-variant">{fact.label}</Text>
            {link ? (
              <TwPressable accessibilityRole="link" onPress={link} className="flex-row items-center gap-1">
                {fact.transactionId ? <Icon icon={Link2} size={14} color="--brand-ink" /> : null}
                <Text weight="medium" className="text-sm text-brand-ink">
                  {fact.value}
                </Text>
              </TwPressable>
            ) : (
              <Text weight="medium" className="text-sm">
                {fact.value}
              </Text>
            )}
          </TwView>
        );
      })}
    </Card>
  );
}
