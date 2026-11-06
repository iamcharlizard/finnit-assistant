'use client';

import { useTranslations } from 'next-intl';
import {
  ChevronRight,
  Landmark,
  PencilLine,
  type LucideIcon,
} from 'lucide-react';

export type AddAccountMode = 'bank' | 'manual';

const OPTIONS: ReadonlyArray<{ mode: AddAccountMode; icon: LucideIcon }> = [
  { mode: 'bank', icon: Landmark },
  { mode: 'manual', icon: PencilLine },
];

/** First step of "Agregar cuenta": connect the bank or add it by hand. */
export function AddAccountChoice({
  onChoose,
}: {
  onChoose: (mode: AddAccountMode) => void;
}) {
  const t = useTranslations('accounts.addChoice');
  return (
    <ul className="flex flex-col gap-3">
      {OPTIONS.map(({ mode, icon: Icon }) => (
        <li key={mode}>
          <button
            type="button"
            onClick={() => onChoose(mode)}
            className="group flex w-full items-center gap-4 rounded-input border border-input bg-surface p-4 text-left transition-colors outline-none hover:border-brand/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-ink">
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-on-background">
                {t(`${mode}.title`)}
                {mode === 'bank' ? (
                  <span className="rounded-full bg-income/10 px-2 py-0.5 text-[11px] font-medium text-income">
                    {t('bank.badge')}
                  </span>
                ) : null}
              </span>
              <span className="text-[13px] text-on-surface-variant">
                {t(`${mode}.description`)}
              </span>
            </span>
            <ChevronRight
              aria-hidden
              className="size-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
