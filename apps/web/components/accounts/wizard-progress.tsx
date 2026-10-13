import { useTranslations } from 'next-intl';

import { cn } from '@finnit/ui/lib/utils';

import { WIZARD_STEPS, type WizardStep } from '@/lib/accounts/form';

/** "Paso 2 de 4: Datos" and a bar per step. */
export function WizardProgress({ step }: { step: WizardStep }) {
  const t = useTranslations('accounts.wizard');
  const index = WIZARD_STEPS.indexOf(step);
  return (
    <div className="flex flex-col gap-2">
      <p
        className="text-xs font-medium text-on-surface-variant"
        aria-live="polite"
      >
        {t('stepOf', {
          current: String(index + 1),
          total: String(WIZARD_STEPS.length),
          step: t(`steps.${step}`),
        })}
      </p>
      <div aria-hidden className="flex gap-1.5">
        {WIZARD_STEPS.map((s, i) => (
          <span
            key={s}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i <= index ? 'bg-brand' : 'bg-track',
            )}
          />
        ))}
      </div>
    </div>
  );
}
