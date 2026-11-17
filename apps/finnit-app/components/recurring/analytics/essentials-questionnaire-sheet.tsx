import * as React from 'react';
import { useTranslations } from 'use-intl';
import { Check, ChevronLeft } from 'lucide-react-native';

import { requestErrorMessage } from '@finnit/core/graphql/request';
import { ESSENTIAL_QUESTIONS, firstOpenStep, isComplete, saveEssentialProfile, type EssentialAnswers } from '@finnit/core/recurring/essentials';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/**
 * "¿Qué podrías recortar?" (the web's EssentialsQuestionnaire): one
 * question per step with closed answers; a tap answers and moves on. At
 * the end the AI classifies the recurring payments. Mounted while open.
 */
export function EssentialsQuestionnaireSheet({ initial, onClose, onDone }: { initial: EssentialAnswers | null; onClose: () => void; onDone: () => void }) {
  const tq = useTranslations('recurring.analytics.questionnaire');
  const ta = useTranslations('recurring.analytics');
  const { t } = useLocalizer();
  const gql = useGql();
  const [answers, setAnswers] = React.useState<EssentialAnswers>(initial ?? {});
  const [step, setStep] = React.useState(() => (initial && isComplete(initial) ? 0 : firstOpenStep(initial ?? {})));
  const [saving, setSaving] = React.useState(false);
  const question = ESSENTIAL_QUESTIONS[step]!;
  const last = step === ESSENTIAL_QUESTIONS.length - 1;
  const chosen = answers[question.key];

  async function finish() {
    setSaving(true);
    try {
      const run = await saveEssentialProfile(answers, gql);
      if (run.aiUnavailable) toast.error(ta('aiUnavailable'));
      else toast.success(ta('analyzed', { count: run.classified }));
      onDone();
    } catch (error) {
      toast.error(requestErrorMessage(error, t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={tq('title')}
      description={tq('step', { current: step + 1, total: ESSENTIAL_QUESTIONS.length })}
      closeLabel={t('common.close')}
    >
      <TwView className="gap-4">
        <Progress value={((step + 1) / ESSENTIAL_QUESTIONS.length) * 100} accessibilityLabel={tq('step', { current: step + 1, total: ESSENTIAL_QUESTIONS.length })} />
        <Text accessibilityRole="header" weight="bold" className="text-base">
          {tq(`questions.${question.key}.label`)}
        </Text>
        <TwView accessibilityRole="radiogroup" className="gap-2">
          {question.options.map((option) => {
            const selected = chosen === option;
            return (
              <TwPressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  setAnswers((current) => ({ ...current, [question.key]: option }));
                  if (!last) setStep(step + 1);
                }}
                className={cn('min-h-12 flex-row items-center justify-between gap-3 rounded-input border px-4', selected ? 'border-brand bg-brand-10' : 'border-outline')}
              >
                <Text className={cn('text-sm', selected ? 'text-brand-ink' : 'text-on-background')}>
                  {/* The key is typed per question; the catalog has them all. */}
                  {tq(`questions.${question.key}.options.${option}` as never)}
                </Text>
                {selected ? <Icon icon={Check} size={16} color="--brand-ink" /> : null}
              </TwPressable>
            );
          })}
        </TwView>
        <TwView className="flex-row gap-3">
          <Button variant="outline" icon={ChevronLeft} label={tq('back')} disabled={step === 0 || saving} onPress={() => setStep(step - 1)} className="flex-1" />
          {last ? (
            <Button label={saving ? tq('saving') : tq('finish')} disabled={!isComplete(answers) || saving} onPress={() => void finish()} className="flex-1" />
          ) : (
            <Button label={tq('next')} disabled={!chosen} onPress={() => setStep(step + 1)} className="flex-1" />
          )}
        </TwView>
      </TwView>
    </Sheet>
  );
}
