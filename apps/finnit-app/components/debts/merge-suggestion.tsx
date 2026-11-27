import { useTranslations } from 'use-intl';
import { Layers } from 'lucide-react-native';

import type { MergeCandidate } from '@finnit/core/debts/api';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

/**
 * The web's MergeSuggestion: a new purchase (or personal loan) with a lender
 * already registered can join that loan, so its payments add up; the user
 * may keep it apart. `chosen`: the loan it joins, 'separate', or null
 * while undecided (saved apart).
 */
export function MergeSuggestion({
  candidates,
  personal,
  chosen,
  onChoose,
}: {
  candidates: MergeCandidate[];
  personal: boolean;
  chosen: string | null;
  onChoose: (choice: string) => void;
}) {
  const t = useTranslations('debts.merge');
  if (candidates.length === 0) return null;
  return (
    <TwView className="gap-3 rounded-input border border-brand-30 bg-brand-5 p-3">
      {candidates.map((candidate) => (
        <TwView key={candidate.id} className="gap-2">
          <TwView className="flex-row items-start gap-2">
            <Icon icon={Layers} size={16} color="--brand-ink" />
            <Text weight="medium" className="flex-1 text-sm">
              {t('title', { name: candidate.name, lender: candidate.lenderName ?? '' })}
            </Text>
          </TwView>
          <Text className="text-xs text-on-surface-variant">{t(personal ? 'personal' : 'purchase')}</Text>
          <TwView className="flex-row flex-wrap gap-2">
            <Button
              size="sm"
              variant={chosen === candidate.id ? 'secondary' : 'outline'}
              accessibilityState={{ selected: chosen === candidate.id }}
              label={t('add')}
              onPress={() => onChoose(candidate.id)}
            />
            <Button
              size="sm"
              variant={chosen === 'separate' ? 'secondary' : 'outline'}
              accessibilityState={{ selected: chosen === 'separate' }}
              label={t('separate')}
              onPress={() => onChoose('separate')}
            />
          </TwView>
        </TwView>
      ))}
    </TwView>
  );
}
