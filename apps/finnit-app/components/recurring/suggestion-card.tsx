import { useTranslations } from 'use-intl';
import { Plus, X } from 'lucide-react-native';

import type { SuggestionCard as Card } from '@finnit/core/recurring/suggestions';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Text } from '@finnit/ui-native/components/ui/text';

import { KindIcon } from './kind-icon';

/** A payment that looks recurring in the user's movements: add it or dismiss it. */
export function SuggestionCard({
  card,
  busy,
  onAdd,
  onDismiss,
}: {
  card: Card;
  busy: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations();
  const details = [t(`finance.recurringKinds.${card.kind}`), card.frequencyLabel, card.accountLabel].filter(Boolean).join(' · ');
  return (
    <TwView className="gap-3 rounded-2xl border border-outline bg-surface p-4">
      <TwView className="flex-row items-start gap-3">
        <KindIcon kind={card.kind} />
        <TwView className="min-w-0 flex-1 gap-0.5">
          <Text weight="bold" numberOfLines={1} className="text-base">
            {card.name}
          </Text>
          <Text numberOfLines={2} className="text-xs text-on-surface-variant">
            {details}
          </Text>
        </TwView>
        <Text weight="bold" className="text-base">
          {card.isVariableAmount ? t('finance.payment.approx', { amount: card.amountLabel }) : card.amountLabel}
        </Text>
      </TwView>
      <TwView className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs text-on-surface-variant">{t('recurring.suggestions.nextDue', { date: card.nextDueLabel })}</Text>
        <Text className="text-xs text-on-surface-variant">· {t('recurring.suggestions.evidence', { count: card.evidence.length })}</Text>
        {card.classifiedByAi ? <Badge variant="highlight" label={t('recurring.suggestions.ai')} /> : null}
      </TwView>
      <TwView className="flex-row justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={X}
          label={t('recurring.suggestions.dismiss')}
          accessibilityLabel={t('recurring.suggestions.dismissLabel', { name: card.name })}
          disabled={busy}
          onPress={onDismiss}
        />
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          label={t('recurring.suggestions.add')}
          accessibilityLabel={t('recurring.suggestions.addLabel', { name: card.name })}
          disabled={busy}
          onPress={onAdd}
        />
      </TwView>
    </TwView>
  );
}
