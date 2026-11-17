'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronLeft } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { Progress } from '@finnit/ui/components/ui/progress';
import { toast } from '@finnit/ui/components/ui/toaster';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';
import { cn } from '@finnit/ui/lib/utils';

import {
  ESSENTIAL_QUESTIONS,
  firstOpenStep,
  isComplete,
  saveEssentialProfile,
  type EssentialAnswers,
} from '@finnit/core/recurring/essentials';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * "¿Qué podrías recortar?": one question at a time, closed answers; at the
 * end the AI classifies the recurring payments with them. Mounted while
 * open.
 */
export function EssentialsQuestionnaire({
  initial,
  onClose,
  onDone,
}: {
  initial: EssentialAnswers | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tq = useTranslations('recurring.analytics.questionnaire');
  const ta = useTranslations('recurring.analytics');
  const [answers, setAnswers] = React.useState<EssentialAnswers>(initial ?? {});
  const [step, setStep] = React.useState(() =>
    initial && isComplete(initial) ? 0 : firstOpenStep(initial ?? {}),
  );
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
      exit.after(onDone)();
    } catch (error) {
      toast.error(requestErrorMessage(error, t));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !saving && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={t('common.close')}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>{tq('title')}</DialogTitle>
          <DialogDescription>
            {tq('step', {
              current: step + 1,
              total: ESSENTIAL_QUESTIONS.length,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Progress
            value={((step + 1) / ESSENTIAL_QUESTIONS.length) * 100}
            aria-hidden
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-base font-bold text-on-background">
              {tq(`questions.${question.key}.label`)}
            </legend>
            <div role="radiogroup" className="flex flex-col gap-2">
              {question.options.map((option) => {
                const selected = chosen === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setAnswers((current) => ({
                        ...current,
                        [question.key]: option,
                      }));
                      if (!last) setStep(step + 1);
                    }}
                    className={cn(
                      'flex min-h-11 items-center justify-between gap-3 rounded-input border px-4 text-left text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      selected
                        ? 'border-brand bg-brand/10 text-brand-ink'
                        : 'border-outline text-on-background hover:bg-accent',
                    )}
                  >
                    {/* The key is typed per question; the catalog has them all. */}
                    {tq(`questions.${question.key}.options.${option}` as never)}
                    {selected ? <Check aria-hidden className="size-4" /> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || saving}
            onClick={() => setStep(step - 1)}
          >
            <ChevronLeft aria-hidden /> {tq('back')}
          </Button>
          {last ? (
            <Button
              type="button"
              variant="secondary"
              disabled={!isComplete(answers) || saving}
              onClick={() => void finish()}
            >
              {saving ? tq('saving') : tq('finish')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={!chosen}
              onClick={() => setStep(step + 1)}
            >
              {tq('next')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
