'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';

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
import { Input } from '@finnit/ui/components/ui/input';

import { SwitchField } from '@/components/finance/switch-field';
import { cn } from '@finnit/ui/lib/utils';

import { accountLabel } from '@/lib/finance/accounts';
import { dayKeyOf, shortDate } from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import { transactionTitle } from '@/lib/finance/transactions';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';
import type { EntryAccount } from '@/lib/new-entry/graphql';
import { accountOptions } from '@/lib/new-entry/options';
import {
  CONVERT_DATA_QUERY,
  CONVERT_TO_TRANSFER_MUTATION,
  candidatesIn,
  convertDirection,
  convertInput,
  convertTargets,
  initialConvertChoice,
  type ConvertData,
  type ConvertSource,
} from '@/lib/transfers/convert';
import type { ApiTransaction } from '@/lib/finance/types';
import { RESOLVE_TRANSFER_SUGGESTION_MUTATION } from '@/lib/transfers/suggestions';

/** Converting from a suggestion: it is resolved, and can be remembered. */
export interface FromSuggestion {
  id: string;
  pattern: string;
  accountId: string | null;
  counterpartTransactionId: string | null;
}

/**
 * "Convertir en transferencia": the movement was money moved between the
 * user's own accounts. The user picks the other account and, when that
 * account already has the opposite movement, which one it was; otherwise
 * that side is created. Mounted while open.
 */
export function ConvertTransferDialog({
  source,
  suggestion,
  onClose,
  onConverted,
}: {
  source: ConvertSource;
  suggestion?: FromSuggestion;
  onClose: () => void;
  onConverted: () => void;
}) {
  const exit = useDialogExit();
  const tc = useTranslations('transfers.convert');
  const { t, locale } = useLocalizer();
  const [data, setData] = React.useState<{
    targets: EntryAccount[];
    candidates: ApiTransaction[];
  } | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [accountId, setAccountId] = React.useState<string | null>(null);
  const [candidateId, setCandidateId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [remember, setRemember] = React.useState(false);
  const [pattern, setPattern] = React.useState(suggestion?.pattern ?? '');
  const direction = convertDirection(source);

  React.useEffect(() => {
    let alive = true;
    gql<ConvertData>(CONVERT_DATA_QUERY, { id: source.id })
      .then((result) => {
        if (!alive) return;
        const targets = convertTargets(
          result.accounts.edges.map((edge) => edge.node),
          source,
        );
        setData({ targets, candidates: result.transferCandidates });
        const start = initialConvertChoice(result.transferCandidates, targets);
        // The suggestion's account (and movement) wins when still valid.
        const suggested =
          suggestion?.accountId &&
          targets.some((a) => a.id === suggestion.accountId)
            ? suggestion.accountId
            : null;
        if (suggested) {
          const inSuggested = candidatesIn(
            result.transferCandidates,
            suggested,
          );
          setAccountId(suggested);
          setCandidateId(
            inSuggested.find(
              (c) => c.id === suggestion?.counterpartTransactionId,
            )?.id ??
              inSuggested[0]?.id ??
              null,
          );
        } else {
          setAccountId(start.accountId);
          setCandidateId(start.candidateId);
        }
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(requestErrorMessage(e, t));
      });
    return () => {
      alive = false;
    };
  }, [source, suggestion, t]);

  const options = React.useMemo(
    () => (data ? accountOptions(data.targets) : []),
    [data],
  );
  const inAccount = data ? candidatesIn(data.candidates, accountId) : [];
  const account = data?.targets.find((a) => a.id === accountId) ?? null;
  const amount = formatMoney(source.amount, source.currency, locale);

  function chooseAccount(id: string | undefined) {
    const next = id ?? null;
    setAccountId(next);
    setCandidateId(
      data ? (candidatesIn(data.candidates, next)[0]?.id ?? null) : null,
    );
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accountId) {
      setError(tc('accountRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (suggestion) {
        await gql(RESOLVE_TRANSFER_SUGGESTION_MUTATION, {
          id: suggestion.id,
          input: {
            action: 'to_account',
            accountId,
            counterpartTransactionId: candidateId,
            remember: remember && pattern.trim().length > 0,
            ...(remember && { pattern: pattern.trim() }),
          },
        });
      } else {
        await gql(CONVERT_TO_TRANSFER_MUTATION, {
          input: convertInput(source, accountId, candidateId),
        });
      }
      exit.after(onConverted)();
    } catch (e) {
      setError(requestErrorMessage(e, t));
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
            <DialogTitle>{tc('title')}</DialogTitle>
            <DialogDescription>
              {tc(direction === 'out' ? 'descriptionOut' : 'descriptionIn', {
                amount,
              })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {loadError ? (
              <p role="alert" className="text-sm text-expense">
                {loadError}
              </p>
            ) : !data ? (
              <p className="text-sm text-on-surface-variant" aria-live="polite">
                {tc('loading')}
              </p>
            ) : data.targets.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                {tc('noAccounts')}
              </p>
            ) : (
              <>
                <Combobox
                  label={tc(direction === 'out' ? 'toAccount' : 'fromAccount')}
                  options={options}
                  value={accountId ?? undefined}
                  onChange={chooseAccount}
                  placeholder={tc('accountPlaceholder')}
                  searchPlaceholder={tc('accountSearch')}
                  emptyText={tc('noResults')}
                />
                {account ? (
                  inAccount.length > 0 ? (
                    <fieldset className="flex flex-col gap-2">
                      <legend className="mb-2 px-1 text-sm text-on-surface-variant">
                        {tc('found', { account: accountLabel(account) })}
                      </legend>
                      <div role="radiogroup" className="flex flex-col gap-2">
                        {inAccount.map((candidate) => (
                          <CandidateOption
                            key={candidate.id}
                            selected={candidateId === candidate.id}
                            title={transactionTitle(candidate, t)}
                            meta={`${shortDate(dayKeyOf(candidate.txnDate), locale)} · ${formatMoney(candidate.amount, candidate.currency, locale)}`}
                            onSelect={() => setCandidateId(candidate.id)}
                          />
                        ))}
                        <CandidateOption
                          selected={candidateId === null}
                          title={tc('createInstead')}
                          meta={tc('createInsteadHint')}
                          onSelect={() => setCandidateId(null)}
                        />
                      </div>
                    </fieldset>
                  ) : (
                    <p className="px-1 text-sm text-on-surface-variant">
                      {tc(
                        direction === 'out' ? 'willCreateIn' : 'willCreateOut',
                        {
                          account: accountLabel(account),
                          amount,
                        },
                      )}
                    </p>
                  )
                ) : null}
              </>
            )}

            {suggestion && data && data.targets.length > 0 ? (
              <RememberField
                remember={remember}
                pattern={pattern}
                onRemember={setRemember}
                onPattern={setPattern}
                hint={
                  account
                    ? tc('rememberHint', { account: accountLabel(account) })
                    : tc('rememberHintNoAccount')
                }
              />
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-expense">
                {error}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={saving || !data || data.targets.length === 0}
            >
              {saving ? tc('saving') : tc('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CandidateOption({
  selected,
  title,
  meta,
  onSelect,
}: {
  selected: boolean;
  title: string;
  meta: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-xl border p-3 text-left transition-colors',
        selected ? 'border-brand bg-brand/5' : 'border-outline hover:bg-track',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border',
          selected
            ? 'border-brand bg-brand text-brand-foreground'
            : 'border-outline',
        )}
      >
        {selected ? <Check className="size-3.5" /> : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-on-background">
          {title}
        </span>
        <span className="text-xs text-on-surface-variant">{meta}</span>
      </span>
    </button>
  );
}

/** "Recordar": the text future bank movements are recognized by. */
export function RememberField({
  remember,
  pattern,
  hint,
  onRemember,
  onPattern,
}: {
  remember: boolean;
  pattern: string;
  hint: string;
  onRemember: (remember: boolean) => void;
  onPattern: (pattern: string) => void;
}) {
  const tc = useTranslations('transfers.convert');
  return (
    <div className="flex flex-col gap-2">
      <SwitchField
        label={tc('remember')}
        hint={hint}
        checked={remember}
        onCheckedChange={onRemember}
      />
      {remember ? (
        <Input
          label={tc('pattern')}
          value={pattern}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => onPattern(e.target.value)}
        />
      ) : null}
    </div>
  );
}
