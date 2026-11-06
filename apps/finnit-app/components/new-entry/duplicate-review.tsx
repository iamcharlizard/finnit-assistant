import { useTranslations } from 'use-intl';

import { dayKeyOf, shortDate } from '@finnit/core/finance/dates';
import { formatMoney } from '@finnit/core/finance/money';
import type { SimilarTransaction } from '@finnit/core/new-entry/graphql';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useLocale } from '@/lib/i18n/i18n-provider';

/** "¿Ya está registrado?": look-alikes of the movement about to be created. */
export function DuplicateReview({
  matches,
  busy,
  error,
  onIsThis,
  onCreateAnyway,
}: {
  matches: SimilarTransaction[];
  busy: boolean;
  error: string | null;
  onIsThis: (transactionId: string) => void;
  onCreateAnyway: () => void;
}) {
  const t = useTranslations('newEntry');
  const { locale } = useLocale();
  return (
    <TwView className="gap-4">
      <Text className="text-sm text-on-surface-variant">{t('duplicates.description', { count: matches.length })}</Text>
      <TwView className="gap-2">
        {matches.map((match) => (
          <TwView key={match.id} className="flex-row items-center gap-3 rounded-xl border border-outline bg-surface p-3">
            <TwView className="min-w-0 flex-1">
              <Text weight="medium" numberOfLines={1} className="text-sm">
                {match.displayName || match.merchantName || match.description || t('duplicates.noDescription')}
              </Text>
              <Text className="text-xs text-on-surface-variant">
                {shortDate(dayKeyOf(match.txnDate), locale)} · {formatMoney(match.amount, match.currency, locale)}
              </Text>
            </TwView>
            <Button variant="outline" size="sm" label={t('duplicates.isThis')} disabled={busy} onPress={() => onIsThis(match.id)} />
          </TwView>
        ))}
      </TwView>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-expense">
          {error}
        </Text>
      ) : null}
      <Button label={busy ? t('saving') : t('duplicates.createAnyway')} disabled={busy} onPress={onCreateAnyway} className="w-full" />
    </TwView>
  );
}
