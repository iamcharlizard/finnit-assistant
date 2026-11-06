'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { Combobox } from '@finnit/ui/components/ui/combobox';
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

import { debtErrorMessage } from '@finnit/core/debts/api';
import {
  buildLinkOptionsView,
  initialPaymentOf,
  linkLoanPayment,
  loadLoanLinkOptions,
  type LinkOptionsView,
  type LinkTargetState,
} from '@finnit/core/debts/links';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import { ChoiceOption } from './choice-option';

const STATE_BADGE: Record<LinkTargetState, 'outline' | 'expense' | 'muted'> = {
  open: 'outline',
  overdue: 'expense',
  paid_without_movement: 'muted',
};

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; view: LinkOptionsView };

/**
 * "Ligar a préstamo" from a movement's detail: pick the loan and the
 * payment the expense covers. The payment due the movement's own day (or
 * one close in date and amount) comes selected. Mounted while open.
 */
export function LinkLoanDialog({
  transactionId,
  amountLabel,
  onClose,
  onLinked,
}: {
  transactionId: string;
  /** The movement's amount, formatted. */
  amountLabel: string;
  onClose: () => void;
  onLinked: (loanName: string) => void;
}) {
  const exit = useDialogExit();
  const l = useLocalizer();
  const { t } = l;
  const tl = useTranslations('debts.links');
  const [state, setState] = React.useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const [debtId, setDebtId] = React.useState<string | null>(null);
  const [occurrenceId, setOccurrenceId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    loadLoanLinkOptions(transactionId, gql)
      .then((options) => {
        if (!live) return;
        const view = buildLinkOptionsView(options, l);
        setState({ status: 'ready', view });
        setDebtId(view.initialDebtId);
        setOccurrenceId(view.initialOccurrenceId);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setError(debtErrorMessage(e, l.t));
        setState({ status: 'error' });
      });
    return () => {
      live = false;
    };
  }, [transactionId, l, attempt]);

  const view = state.status === 'ready' ? state.view : null;
  const loan = view?.loans.find((x) => x.debtId === debtId) ?? null;
  const payment =
    loan?.payments.find((p) => p.occurrenceId === occurrenceId) ?? null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!loan || !payment) return;
    setSaving(true);
    setError(null);
    try {
      await linkLoanPayment(payment.occurrenceId, transactionId, gql);
      exit.after(onLinked)(loan.label);
    } catch (e) {
      setError(debtErrorMessage(e, t));
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
        className="sm:max-w-lg"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{tl('title')}</DialogTitle>
            <DialogDescription>
              {tl('description', { amount: amountLabel })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {state.status === 'loading' ? (
              <p className="text-sm text-on-surface-variant" aria-live="polite">
                {tl('loading')}
              </p>
            ) : null}
            {state.status === 'error' ? (
              <p role="alert" className="flex items-center gap-2 text-sm">
                {error ?? tl('loadError')}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    setAttempt((n) => n + 1);
                  }}
                >
                  {tl('retry')}
                </Button>
              </p>
            ) : null}
            {view && view.loans.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{tl('noLoans')}</p>
            ) : null}
            {view && view.loans.length > 0 ? (
              <>
                <Combobox
                  label={tl('loan')}
                  options={view.loans.map((x) => ({
                    value: x.debtId,
                    label: x.label,
                  }))}
                  value={debtId ?? undefined}
                  onChange={(next) => {
                    setDebtId(next ?? null);
                    const picked = view.loans.find((x) => x.debtId === next);
                    setOccurrenceId(picked ? initialPaymentOf(picked) : null);
                  }}
                  placeholder={tl('loanPlaceholder')}
                  searchPlaceholder={tl('loanSearch')}
                  emptyText={tl('noResults')}
                />
                {loan ? (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 px-1 text-sm text-on-surface-variant">
                      {tl('pickPayment')}
                    </legend>
                    {loan.payments.length === 0 ? (
                      <p className="px-1 text-sm text-on-surface-variant">
                        {tl('noPayments')}
                      </p>
                    ) : (
                      <div role="radiogroup" className="flex flex-col gap-2">
                        {loan.payments.map((p) => (
                          <ChoiceOption
                            key={p.occurrenceId}
                            selected={occurrenceId === p.occurrenceId}
                            title={p.dateLabel}
                            amount={p.amountLabel}
                            badges={
                              <>
                                {p.suggested ? (
                                  <Badge variant="brand">
                                    {tl('suggested')}
                                  </Badge>
                                ) : null}
                                <Badge variant={STATE_BADGE[p.state]}>
                                  {tl(`states.${p.state}`)}
                                </Badge>
                              </>
                            }
                            onSelect={() => setOccurrenceId(p.occurrenceId)}
                          />
                        ))}
                      </div>
                    )}
                  </fieldset>
                ) : null}
                {payment?.state === 'paid_without_movement' ? (
                  <p className="px-1 text-xs text-on-surface-variant">
                    {tl('paidWithoutHint')}
                  </p>
                ) : null}
              </>
            ) : null}
            {error && state.status === 'ready' ? (
              <p role="alert" className="text-[13px] text-expense">
                {error}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="secondary"
              disabled={saving || !payment}
            >
              {saving ? tl('saving') : tl('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
