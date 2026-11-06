'use client';

import * as React from 'react';
import { track } from '@vercel/analytics';
import { ArrowRight, CircleCheck, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@finnit/ui/components/ui/button';
import { Input } from '@finnit/ui/components/ui/input';
import { cn } from '@finnit/ui/lib/utils';

import { joinWaitlist } from '@/app/waitlist-actions';
import { HONEYPOT_FIELD, WAITLIST_IDLE } from '@/lib/landing/waitlist';

/**
 * Email field + button for the waitlist. `placement` tells the analytics
 * event which form converted (hero or the closing call to action).
 */
export function WaitlistForm({
  placement,
  source,
  className,
}: {
  placement: 'hero' | 'footer';
  source?: string;
  className?: string;
}) {
  const t = useTranslations('landing.form');
  const [state, action, pending] = React.useActionState(
    joinWaitlist,
    WAITLIST_IDLE,
  );
  const id = React.useId();

  React.useEffect(() => {
    // Custom events are counted on Vercel Pro plans; elsewhere a no-op.
    if (state.status === 'success') track('waitlist_joined', { placement });
  }, [state, placement]);

  if (state.status === 'success') {
    return (
      <p
        role="status"
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-ai/40 bg-ai/10 px-5 py-4 text-sm font-medium text-on-background',
          className,
        )}
      >
        <CircleCheck aria-hidden className="size-5 shrink-0 text-ai-ink" />
        {t('success')}
      </p>
    );
  }

  const error = state.status === 'error' ? state.error : null;
  return (
    <form
      action={action}
      className={cn('@container flex flex-col gap-2', className)}
      noValidate
    >
      <label htmlFor={`${id}-email`} className="sr-only">
        {t('label')}
      </label>
      <div className="flex flex-col gap-2 rounded-[28px] border border-outline bg-surface/80 p-1.5 shadow-elevation backdrop-blur-md @lg:flex-row">
        <Input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={t('placeholder')}
          defaultValue={state.status === 'error' ? state.email : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
          className="h-12 flex-1 border-0 bg-transparent px-4 text-base shadow-none focus-visible:ring-0"
        />
        {/* Hidden from people; bots that fill every field reveal themselves. */}
        <input
          type="text"
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute -left-[9999px] size-px opacity-0"
        />
        {source ? <input type="hidden" name="source" value={source} /> : null}
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="min-h-12 shrink-0"
        >
          {pending ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            <ArrowRight aria-hidden />
          )}
          {pending ? t('submitting') : t('submit')}
        </Button>
      </div>
      <p
        id={`${id}-hint`}
        role={error ? 'alert' : undefined}
        className={cn(
          'px-4 text-xs',
          error ? 'text-expense' : 'text-on-surface-variant',
        )}
      >
        {error ? t(`errors.${error}`) : t('note')}
      </p>
    </form>
  );
}
