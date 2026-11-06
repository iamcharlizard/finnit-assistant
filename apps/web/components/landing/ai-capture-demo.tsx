import { Coffee, CreditCard, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@finnit/ui/lib/utils';

/**
 * The hero's illustration: a receipt being read (a scan line sweeps over
 * it) and the expense Finnit drafts from it. Static sample data; nothing
 * here is interactive.
 */
export async function AiCaptureDemo({ className }: { className?: string }) {
  const t = await getTranslations('landing.demo');
  return (
    <figure
      aria-label={t('label')}
      className={cn('relative mx-auto w-full max-w-[440px]', className)}
    >
      {/* Glow behind, in the AI color. */}
      <div
        aria-hidden
        className="absolute inset-x-10 top-16 -z-10 h-64 rounded-full bg-ai/25 blur-3xl"
      />

      {/* The receipt, slightly turned. */}
      <div
        aria-hidden
        className="relative ml-2 w-[62%] -rotate-6 rounded-[18px] border border-outline bg-surface px-5 pt-5 pb-7 shadow-elevation [mask-image:linear-gradient(to_bottom,black_88%,transparent)]"
      >
        <p className="text-center text-[11px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">
          {t('receiptTitle')}
        </p>
        <p className="mt-2 text-center text-sm font-bold text-on-background">
          {t('merchant')}
        </p>
        <div className="mt-4 space-y-2 border-t border-dashed border-outline pt-3 font-mono text-[12px] text-on-surface-variant">
          <p className="flex justify-between">
            <span>{t('item1')}</span>
            <span>$62.00</span>
          </p>
          <p className="flex justify-between">
            <span>{t('item2')}</span>
            <span>$24.50</span>
          </p>
          <p className="flex justify-between border-t border-dashed border-outline pt-2 font-bold text-on-background">
            <span>{t('total')}</span>
            <span>$86.50</span>
          </p>
        </div>
        <div className="mt-4 flex justify-center gap-[3px]">
          {Array.from({ length: 22 }, (_, i) => (
            <span
              key={i}
              className="h-7 bg-on-background/70"
              style={{ width: i % 3 === 0 ? 3 : 1.5 }}
            />
          ))}
        </div>
        {/* The scan line. */}
        <span className="landing-scan absolute inset-x-3 h-[2px] rounded-full bg-ai shadow-[0_0_14px_2px_var(--ai)]" />
      </div>

      {/* The drafted expense. */}
      <div className="relative -mt-16 ml-auto w-[78%] rounded-[22px] border border-glass-border bg-glass p-4 shadow-elevation glass">
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-ai-ink uppercase">
          <Sparkles aria-hidden className="size-3.5" />
          {t('detected')}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-expense/10 text-expense">
            <Coffee aria-hidden className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-on-background">
              {t('merchant')}
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-xs text-on-surface-variant">
              <CreditCard aria-hidden className="size-3.5" />
              {t('account')}
            </span>
          </span>
          <span className="text-[15px] font-bold text-expense tabular-nums">
            −$86.50
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ai/40 bg-ai/10 px-3 py-1 text-xs font-medium text-on-background">
            <Sparkles aria-hidden className="size-3 text-ai-ink" />
            {t('category')}
            <span className="sr-only">· {t('suggested')}</span>
          </span>
          <span
            aria-hidden
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
          >
            {t('confirm')}
          </span>
        </div>
      </div>
    </figure>
  );
}
