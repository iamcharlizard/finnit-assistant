'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Unlink } from 'lucide-react';

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
  choiceKey,
  initialCardInstallmentChoice,
  linkCardInstallment,
  loadCardInstallmentLinkOptions,
  toCardInstallmentLinkView,
  unlinkCardInstallment,
  type ApiCardInstallmentLinkOptions,
  type CardInstallmentChoice,
} from '@finnit/core/debts/card-installment-links';
import { dayKeyOf, shortDate } from '@finnit/core/finance/dates';
import { formatMoney } from '@finnit/core/finance/money';
import { transactionErrorMessage } from '@finnit/core/transaction-detail/api';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; options: ApiCardInstallmentLinkOptions };

/**
 * "Ligar a compra a meses" from an expense on a credit card: it is the
 * whole purchase of one of the card's purchases in installments, or one of
 * its installments (the one that fits comes picked). Already linked, it
 * says to what and offers to unlink. "Crear compra a meses con este gasto"
 * hands over to the new debt form. Mounted while open.
 */
export function LinkCardInstallmentDialog({
  transaction,
  onClose,
  onChanged,
  onCreate,
}: {
  transaction: {
    id: string;
    amount: number;
    currency: string;
    txnDate: string;
  };
  onClose: () => void;
  /** Linked or unlinked: the toast's text. */
  onChanged: (message: string) => void;
  /** Opens "Nueva deuda" on a card purchase made from this expense. */
  onCreate: () => void;
}) {
  const exit = useDialogExit();
  const l = useLocalizer();
  const t = useTranslations('transaction.linkCardInstallment');
  const [state, setState] = React.useState<State>({ status: 'loading' });
  const [picked, setPicked] = React.useState<CardInstallmentChoice | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    loadCardInstallmentLinkOptions(transaction.id, gql)
      .then((options) => {
        if (!live) return;
        setState({ status: 'ready', options });
        setPicked(initialCardInstallmentChoice(options));
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
  }, [transaction.id, l]);

  const options = state.status === 'ready' ? state.options : null;
  const view = options
    ? toCardInstallmentLinkView(options, transaction.currency, l)
    : null;
  const pickedKey = picked ? choiceKey(picked) : null;
  const pickedPlan = options?.plans.find((p) => p.debtId === picked?.debtId);

  async function run(action: () => Promise<void>, message: string) {
    setSaving(true);
    setError(null);
    try {
      await action();
      exit.after(onChanged)(message);
    } catch (e) {
      setError(transactionErrorMessage(e, l.t));
      setSaving(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!picked || !pickedPlan) return;
    void run(
      () => linkCardInstallment(transaction.id, picked, gql),
      t('done', { name: pickedPlan.name }),
    );
  }

  const linked = options?.linked ?? null;

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
              {t('description', {
                amount: formatMoney(
                  transaction.amount,
                  transaction.currency,
                  l.locale,
                ),
                date: shortDate(dayKeyOf(transaction.txnDate), l.locale),
              })}
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

            {view?.linked && linked ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-track/60 p-3 text-sm text-on-background">
                <span>{view.linked}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() =>
                    void run(
                      () => unlinkCardInstallment(linked, gql),
                      t('unlinked', { name: linked.name }),
                    )
                  }
                >
                  <Unlink aria-hidden /> {t('unlink')}
                </Button>
              </div>
            ) : null}

            {view && !view.linked && view.plans.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('empty')}</p>
            ) : null}

            {view && !view.linked
              ? view.plans.map((plan) => (
                  <section key={plan.debtId} className="flex flex-col gap-2">
                    <div className="px-1">
                      <h3 className="text-sm font-semibold text-on-background">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        {plan.detail}
                      </p>
                    </div>
                    {plan.note ? (
                      <p className="px-1 text-xs text-on-surface-variant">
                        {plan.note}
                      </p>
                    ) : null}
                    {plan.rows.length > 0 ? (
                      <div
                        role="radiogroup"
                        aria-label={plan.name}
                        className="flex flex-col gap-2"
                      >
                        {plan.rows.map((row) => (
                          <ChoiceOption
                            key={row.key}
                            selected={pickedKey === row.key}
                            title={row.title}
                            meta={row.meta}
                            badges={
                              row.proposed ? (
                                <Badge variant="brand">{t('proposed')}</Badge>
                              ) : null
                            }
                            onSelect={() => setPicked(row.choice)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))
              : null}

            {options && !linked ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                disabled={saving}
                onClick={() => exit.close(onCreate)}
              >
                <Plus aria-hidden /> {t('create')}
              </Button>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-expense">
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
            {!linked ? (
              <Button type="submit" disabled={!picked || saving}>
                {t('submit')}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
