'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';

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
import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@finnit/ui/components/ui/select';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { ChoiceOption } from '@/components/loan-links/choice-option';
import {
  initialLinkChoice,
  linkIntro,
  linkRecurringPayment,
  loadRecurringLinkOptions,
  toRecurringLinkView,
  type ApiRecurringLinkOptions,
  type RecurringLinkRow,
} from '@finnit/core/recurring/links';
import { transactionErrorMessage } from '@finnit/core/transaction-detail/api';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; options: ApiRecurringLinkOptions };

/**
 * "Ligar a gasto recurrente" from an expense's detail: the month of the
 * payment (the expense's by default), the suggested recurring expenses
 * (due near its day with a similar amount; the best one selected) and the
 * rest, with a search. Mounted while open.
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
  const [month, setMonth] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    loadRecurringLinkOptions(transaction.id, gql)
      .then((options) => {
        if (!live) return;
        const initial = initialLinkChoice(options);
        setState({ status: 'ready', options });
        setPicked(initial.id);
        setMonth(initial.month);
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
  const view =
    options && month
      ? toRecurringLinkView(options, month, query, transaction.currency, l)
      : null;
  const rows = view ? [...view.suggested, ...view.others] : [];
  const choice = rows.find((r) => r.id === picked && !r.disabled) ?? null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!choice || !month) return;
    setSaving(true);
    setError(null);
    try {
      await linkRecurringPayment(transaction.id, choice.id, month, gql);
      exit.after(onLinked)(choice.name);
    } catch (e) {
      setError(transactionErrorMessage(e, l.t));
      setSaving(false);
    }
  }

  const list = (title: string, items: RecurringLinkRow[]) =>
    items.length > 0 ? (
      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
          {title}
        </h3>
        <div
          role="radiogroup"
          aria-label={title}
          className="flex flex-col gap-2"
        >
          {items.map((row) => (
            <ChoiceOption
              key={row.id}
              selected={picked === row.id}
              title={row.name}
              meta={row.detail}
              badges={
                row.id === options?.proposedId && row.suggested ? (
                  <Badge variant="brand">{t('proposed')}</Badge>
                ) : null
              }
              disabled={row.disabled}
              onSelect={() => setPicked(row.id)}
            />
          ))}
        </div>
      </section>
    ) : null;

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
            {options && options.expenses.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('empty')}</p>
            ) : null}
            {options && view && options.expenses.length > 0 ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex flex-col gap-1.5 sm:w-48">
                    <label
                      htmlFor="link-month"
                      className="px-1 text-xs font-medium text-on-surface-variant"
                    >
                      {t('month')}
                    </label>
                    <Select value={month ?? undefined} onValueChange={setMonth}>
                      <SelectTrigger id="link-month" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {view.months.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div
                    role="search"
                    className="flex flex-1 flex-col justify-end"
                  >
                    <InputWithIcon
                      iconLeft={Search}
                      type="search"
                      aria-label={t('search')}
                      placeholder={t('search')}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                {rows.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">
                    {t('noResults')}
                  </p>
                ) : null}
                {list(t('suggestedTitle'), view.suggested)}
                {list(t('othersTitle'), view.others)}
              </>
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
            <Button type="submit" disabled={!choice || saving}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
