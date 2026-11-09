'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Badge } from '@finnit/ui/components/ui/badge';
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
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { ChoiceOption } from '@/components/loan-links/choice-option';
import {
  linkRecurringPayment,
  loadRecurringLinkOptions,
  linkIntro,
  toRecurringLinkOptions,
  type RecurringLinkOptionView,
} from '@finnit/core/recurring/links';
import { transactionErrorMessage } from '@finnit/core/transaction-detail/api';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; options: RecurringLinkOptionView[] };

/**
 * "Ligar a gasto recurrente" from an expense's detail: pick the scheduled
 * payment it covered (the clear one comes selected). Linking marks it paid
 * and gives the expense its category. Mounted while open.
 */
export function LinkRecurringDialog({
  transaction,
  onClose,
  onLinked,
}: {
  /** The expense: its id, amount, currency and day. */
  transaction: {
    id: string;
    amount: number;
    currency: string;
    txnDate: string;
  };
  onClose: () => void;
  onLinked: (name: string) => void;
}) {
  const exit = useDialogExit();
  const l = useLocalizer();
  const t = useTranslations('transaction.linkRecurring');
  const [state, setState] = React.useState<State>({ status: 'loading' });
  const [picked, setPicked] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    loadRecurringLinkOptions(transaction.id, gql)
      .then((raw) => {
        if (!live) return;
        const { options, initial } = toRecurringLinkOptions(
          raw,
          transaction.currency,
          l,
        );
        setState({ status: 'ready', options });
        setPicked(initial);
      })
      .catch((e: unknown) => {
        if (live) {
          setState({
            status: 'error',
            message: transactionErrorMessage(e, l.t),
          });
        }
      });
    return () => {
      live = false;
    };
  }, [transaction.id, transaction.currency, l]);

  const options = state.status === 'ready' ? state.options : [];
  const choice = options.find((o) => o.occurrenceId === picked) ?? null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!choice) return;
    setSaving(true);
    setError(null);
    try {
      await linkRecurringPayment(transaction.id, choice.occurrenceId, gql);
      exit.after(onLinked)(choice.name);
    } catch (e) {
      setError(transactionErrorMessage(e, l.t));
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
        closeLabel={l.t('common.close')}
        className="sm:max-w-lg"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>
              {t('description', linkIntro(transaction, l))}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {state.status === 'loading' ? (
              <p className="text-sm text-on-surface-variant" aria-live="polite">
                {t('loading')}
              </p>
            ) : null}
            {state.status === 'error' ? (
              <p role="alert" className="text-sm text-expense">
                {state.message}
              </p>
            ) : null}
            {state.status === 'ready' && options.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('empty')}</p>
            ) : null}
            {options.length > 0 ? (
              <div role="radiogroup" className="flex flex-col gap-2">
                {options.map((o) => (
                  <ChoiceOption
                    key={o.occurrenceId}
                    selected={picked === o.occurrenceId}
                    title={o.name}
                    meta={o.detail}
                    badges={
                      o.proposed ? (
                        <Badge variant="brand">{t('proposed')}</Badge>
                      ) : null
                    }
                    onSelect={() => setPicked(o.occurrenceId)}
                  />
                ))}
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="mt-3 text-sm text-expense">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {l.t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!choice || saving}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
