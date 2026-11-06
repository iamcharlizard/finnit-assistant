'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { History, Sparkles, WandSparkles, Layers } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import { toast } from '@finnit/ui/components/ui/toaster';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';
import { cn } from '@finnit/ui/lib/utils';

import {
  AUTO_CATEGORIZE_MODES,
  AUTO_CATEGORIZE_MUTATION,
  autoCategorizeOutcome,
  type AutoCategorizeMode,
  type AutoCategorizeResult,
} from '@finnit/core/categorize/auto';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

const MODE_ICONS = { history: History, ai: Sparkles, both: Layers } as const;

/**
 * "Clasificar automáticamente": opens a dialog where the user picks how:
 * only from their past categorizations (applied at once), with AI
 * (suggestions to accept or reject), or both.
 */
export function AutoCategorizeButton() {
  const t = useTranslations('categorize.auto');
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <WandSparkles aria-hidden /> {t('button')}
      </Button>
      {open ? <AutoCategorizeDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AutoCategorizeDialog({ onClose }: { onClose: () => void }) {
  const exit = useDialogExit();
  const t = useTranslations('categorize.auto');
  const { t: translate } = useLocalizer();
  const router = useRouter();
  const [mode, setMode] = React.useState<AutoCategorizeMode>('both');
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const { autoCategorizeTransactions: result } = await gql<{
        autoCategorizeTransactions: AutoCategorizeResult;
      }>(AUTO_CATEGORIZE_MUTATION, { mode });
      const outcome = autoCategorizeOutcome(mode, result);
      const description = t('remaining', { count: result.remaining });
      const message = t(`results.${outcome}`, {
        categorized: result.categorized,
        suggested: result.suggested,
      });
      if (outcome === 'nothing') toast(message, { description });
      else toast.success(message, { description });
      router.refresh();
      exit.close(onClose);
    } catch (e) {
      setError(requestErrorMessage(e, translate));
      setRunning(false);
    }
  }

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(next) => !next && !running && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={translate('common.close')}
        className="sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <fieldset className="flex flex-col gap-2" disabled={running}>
            <legend className="sr-only">{t('title')}</legend>
            {AUTO_CATEGORIZE_MODES.map((value) => {
              const Icon = MODE_ICONS[value];
              const selected = value === mode;
              return (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                    selected
                      ? 'border-brand bg-brand/5'
                      : 'border-outline hover:bg-track',
                  )}
                >
                  <input
                    type="radio"
                    name="auto-categorize-mode"
                    value={value}
                    checked={selected}
                    onChange={() => setMode(value)}
                    className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm font-medium text-on-background">
                      <Icon
                        aria-hidden
                        className="size-4 text-on-surface-variant"
                      />
                      {t(`modes.${value}.label`)}
                      {value === 'both' ? (
                        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-ink uppercase">
                          {t('recommended')}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {t(`modes.${value}.description`)}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          {mode !== 'history' ? (
            <p className="text-xs text-on-surface-variant">{t('aiNote')}</p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-expense">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={running}>
              {translate('common.cancel')}
            </Button>
          </DialogClose>
          <Button type="button" onClick={run} disabled={running}>
            {running
              ? mode === 'history'
                ? t('running')
                : t('runningAi')
              : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
