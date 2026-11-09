'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';

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
import { cn } from '@finnit/ui/lib/utils';

import { CandidateOption } from '@/components/transfers/convert-transfer-dialog';
import { gql } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import {
  duplicateCandidates,
  mergeTransactions,
  type MergeNameFrom,
} from '@finnit/core/duplicates/request';
import {
  mergePlan,
  toMergeSide,
  type MergeSide,
} from '@finnit/core/duplicates/view';
import type { ApiTransaction } from '@finnit/core/finance/types';
import { transactionErrorMessage } from '@finnit/core/transaction-detail/api';

/** Days apart two records of the same money may be (the API's window). */
const DAYS = 3;

/**
 * "Marcar como duplicado": the same money recorded twice. The user picks
 * the other record (or comes with it, from a suggestion), sees which one
 * stays (the bank's) and which goes, chooses the name to show and merges.
 * Mounted while open.
 */
export function MergeDuplicateDialog({
  transaction,
  other: givenOther,
  onClose,
  onMerged,
}: {
  transaction: ApiTransaction;
  /** Already known (a suggestion): skips the picking step. */
  other?: ApiTransaction;
  onClose: () => void;
  /** With the id of the movement that stays. */
  onMerged: (keptId: string) => void;
}) {
  const exit = useDialogExit();
  const l = useLocalizer();
  const td = useTranslations('duplicates.dialog');
  const [candidates, setCandidates] = React.useState<ApiTransaction[] | null>(
    givenOther ? [givenOther] : null,
  );
  const [otherId, setOtherId] = React.useState<string | null>(
    givenOther?.id ?? null,
  );
  const [picked, setPicked] = React.useState(Boolean(givenOther));
  const [nameFrom, setNameFrom] = React.useState<MergeNameFrom | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (givenOther) return;
    let live = true;
    duplicateCandidates(transaction.id, gql)
      .then((rows) => {
        if (!live) return;
        setCandidates(rows);
        if (rows.length === 1) setOtherId(rows[0]!.id);
      })
      .catch((e: unknown) => live && setError(transactionErrorMessage(e, l.t)));
    return () => {
      live = false;
    };
  }, [transaction.id, givenOther, l.t]);

  const other = candidates?.find((c) => c.id === otherId) ?? null;
  const plan = other ? mergePlan(transaction, other, l) : null;
  const chosenName = nameFrom ?? plan?.defaultName ?? 'keep';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!picked) {
      if (other) setPicked(true);
      return;
    }
    if (!plan || plan.blocked) return;
    setSaving(true);
    setError(null);
    try {
      const kept = await mergeTransactions(
        { keepId: plan.keep.id, dropId: plan.drop.id, nameFrom: chosenName },
        gql,
      );
      exit.after(onMerged)(kept);
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
        <form
          onSubmit={submit}
          noValidate
          className="flex min-h-0 flex-col gap-5"
        >
          <DialogHeader>
            <DialogTitle>{td('title')}</DialogTitle>
            <DialogDescription>
              {picked ? td('keepHint') : td('pickHint', { days: DAYS })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {!picked ? (
              candidates === null && !error ? (
                <p className="text-sm text-on-surface-variant">
                  {l.t('common.loading')}
                </p>
              ) : candidates && candidates.length > 0 ? (
                <div
                  role="radiogroup"
                  aria-label={td('pick')}
                  className="flex flex-col gap-2"
                >
                  <p className="text-sm font-medium text-on-background">
                    {td('pick')}
                  </p>
                  {candidates.map((candidate) => {
                    const side = toMergeSide(candidate, l);
                    return (
                      <CandidateOption
                        key={candidate.id}
                        selected={candidate.id === otherId}
                        title={side.title}
                        meta={[
                          side.amount,
                          side.date,
                          side.origin,
                          side.category,
                        ].join(' · ')}
                        onSelect={() => setOtherId(candidate.id)}
                      />
                    );
                  })}
                </div>
              ) : candidates ? (
                <p className="text-sm text-on-surface-variant">{td('none')}</p>
              ) : null
            ) : plan ? (
              <>
                <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
                  <SideCard side={plan.drop} label={td('drop')} tone="drop" />
                  <ArrowRight
                    aria-hidden
                    className="hidden size-5 self-center text-on-surface-variant sm:block"
                  />
                  <SideCard side={plan.keep} label={td('keep')} tone="keep" />
                </div>
                {plan.blocked ? (
                  <p role="alert" className="text-sm text-expense">
                    {td('bothBank')}
                  </p>
                ) : (
                  <>
                    {plan.names.length > 1 ? (
                      <div
                        role="radiogroup"
                        aria-label={td('name')}
                        className="flex flex-col gap-2"
                      >
                        <p className="text-sm font-medium text-on-background">
                          {td('name')}
                        </p>
                        {plan.names.map((name) => (
                          <CandidateOption
                            key={name.value}
                            selected={chosenName === name.value}
                            title={name.label}
                            meta={
                              name.value === 'keep'
                                ? plan.keep.origin
                                : plan.drop.origin
                            }
                            onSelect={() => setNameFrom(name.value)}
                          />
                        ))}
                      </div>
                    ) : null}
                    <p className="text-sm text-on-surface-variant">
                      {td('outcome', {
                        name: plan.drop.title,
                        amount: plan.drop.amount,
                        account: plan.drop.account,
                      })}
                    </p>
                  </>
                )}
              </>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-expense">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            {picked && !givenOther ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setPicked(false)}
              >
                {td('back')}
              </Button>
            ) : (
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  {l.t('common.cancel')}
                </Button>
              </DialogClose>
            )}
            <Button
              type="submit"
              disabled={saving || !other || Boolean(picked && plan?.blocked)}
            >
              {saving ? td('merging') : picked ? td('confirm') : td('next')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SideCard({
  side,
  label,
  tone,
}: {
  side: MergeSide;
  label: string;
  tone: 'keep' | 'drop';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-xl border p-3',
        tone === 'keep'
          ? 'border-income/40 bg-income/5'
          : 'border-outline bg-track/60',
      )}
    >
      <span
        className={cn(
          'text-[11px] font-semibold tracking-widest uppercase',
          tone === 'keep' ? 'text-income' : 'text-on-surface-variant',
        )}
      >
        {label}
      </span>
      <span className="truncate text-sm font-medium text-on-background">
        {side.title}
      </span>
      <span className="text-sm font-semibold text-on-background tabular-nums">
        {side.amount}
      </span>
      <span className="truncate text-xs text-on-surface-variant">
        {[side.date, side.origin, side.category].join(' · ')}
      </span>
    </div>
  );
}
