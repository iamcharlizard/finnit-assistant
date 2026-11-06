'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { LockKeyhole, Wand2 } from 'lucide-react';
import Link from 'next/link';

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
import { Input } from '@finnit/ui/components/ui/input';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { AliasDialog } from '@/components/aliases/alias-dialog';
import { SwitchField } from '@/components/finance/switch-field';
import { aliasPatternGuess } from '@/lib/aliases/guess';
import type { ApiMerchantAlias } from '@/lib/aliases/types';
import {
  DISPLAY_NAME_MAX,
  privateByRule,
  renameChanged,
  renameFormOf,
  renameInput,
  validateRename,
  type NameSubject,
  type RenameError,
  type RenameForm,
} from '@/lib/categorize/rename';
import type { CategorizeCategory } from '@/lib/categorize/types';
import { useLocalizer } from '@/lib/i18n/client';

export type NameSaved =
  | { kind: 'name'; removed: boolean }
  | { kind: 'rule'; rule: ApiMerchantAlias };

/**
 * The name of a movement, in one place (history, Clasificar, detail):
 * the bank text, the automatic name that applies (if any), its own name
 * (optional; it wins over the automatic one) and its own privacy. From
 * here the user can also make an automatic name for every similar
 * movement ("Usar un nombre automático para los parecidos"), which opens
 * the rule editor prefilled with this movement. Mounted while open.
 */
export function TransactionNameDialog({
  subject,
  categories,
  submit,
  onClose,
  onSaved,
}: {
  subject: NameSubject;
  /** For the automatic name's category picker. */
  categories: CategorizeCategory[];
  /** Saves the own name and privacy (setTransactionAlias). */
  submit: (input: ReturnType<typeof renameInput>) => Promise<void>;
  onClose: () => void;
  onSaved: (saved: NameSaved) => void;
}) {
  const exit = useDialogExit();
  const { t } = useLocalizer();
  const tn = useTranslations('transaction.name');
  const [form, setForm] = React.useState<RenameForm>(() =>
    renameFormOf(subject),
  );
  const [error, setError] = React.useState<RenameError | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  // The automatic-name editor replaces this dialog while open.
  const [makingRule, setMakingRule] = React.useState(false);
  const byRule = privateByRule(subject);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const found = validateRename(form);
    setError(found);
    if (found) return;
    if (!renameChanged(subject, form)) {
      exit.close(onClose);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      await submit(renameInput(form));
      exit.after(onSaved)({
        kind: 'name',
        removed: subject.hasOwnAlias && !form.displayName.trim(),
      });
    } catch (e) {
      setSubmitError(
        (e as { message?: string })?.message
          ? String((e as { message?: string }).message)
          : t('errors.unexpected'),
      );
      setSaving(false);
    }
  }

  if (makingRule) {
    return (
      <AliasDialog
        alias={null}
        categories={categories}
        exampleIds={[subject.id]}
        initial={{
          matchType: 'contains',
          pattern: aliasPatternGuess(subject.original),
          displayName: form.displayName.trim(),
          categoryId: subject.categoryId ?? undefined,
          isPrivate: form.isPrivate || byRule,
        }}
        onClose={onClose}
        onSaved={async (rule) => {
          // The own name would hide the new automatic one: drop it.
          if (subject.hasOwnAlias) {
            await submit({
              displayName: null,
              isPrivate: form.isPrivate,
            }).catch(() => undefined);
          }
          onSaved({ kind: 'rule', rule });
        }}
      />
    );
  }

  return (
    <Dialog
      open={exit.open}
      onOpenChange={(open) => !open && !saving && exit.close(onClose)}
    >
      <DialogContent
        onExitComplete={exit.onExitComplete}
        closeLabel={t('common.close')}
        className="sm:max-w-md"
      >
        <form noValidate className="flex flex-col gap-5" onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{tn('title')}</DialogTitle>
            <DialogDescription>{tn('description')}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <dl className="flex flex-col gap-2 rounded-input bg-track p-3 text-xs">
              <div>
                <dt className="font-medium text-on-surface-variant">
                  {tn('bankText')}
                </dt>
                <dd className="break-words font-mono text-on-background">
                  {subject.original ?? tn('bankTextHidden')}
                </dd>
              </div>
              {subject.rule ? (
                <div>
                  <dt className="font-medium text-on-surface-variant">
                    {tn('automatic')}
                  </dt>
                  <dd className="flex flex-wrap items-center gap-1 text-on-background">
                    {subject.rule.isProtected ? (
                      <LockKeyhole aria-hidden className="size-3.5" />
                    ) : null}
                    {subject.rule.displayName}
                    <Link
                      href="/settings/aliases"
                      className="font-medium text-brand-ink underline-offset-4 hover:underline"
                    >
                      {tn('seeRules')}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="flex flex-col gap-1">
              <Input
                label={tn('ownName')}
                value={form.displayName}
                maxLength={DISPLAY_NAME_MAX}
                autoComplete="off"
                autoFocus
                placeholder={
                  subject.rule?.displayName ?? tn('ownNamePlaceholder')
                }
                onChange={(e) => {
                  setForm((f) => ({ ...f, displayName: e.target.value }));
                  setError(null);
                }}
                error={
                  error === 'tooLong'
                    ? tn('tooLong', { max: DISPLAY_NAME_MAX })
                    : undefined
                }
              />
              <p className="px-1 text-xs text-on-surface-variant">
                {subject.rule ? tn('ownNameHintRule') : tn('ownNameHint')}
              </p>
            </div>

            {byRule ? (
              <p className="flex items-start gap-2 rounded-input bg-track p-3 text-xs text-on-surface-variant">
                <LockKeyhole aria-hidden className="mt-0.5 size-4 shrink-0" />
                {tn(
                  subject.rule?.isProtected
                    ? 'privateByProtectedRule'
                    : 'privateByRule',
                  { name: subject.rule?.displayName ?? '' },
                )}
              </p>
            ) : (
              <SwitchField
                label={tn('private')}
                hint={tn('privateHint')}
                checked={form.isPrivate}
                onCheckedChange={(isPrivate) =>
                  setForm((f) => ({ ...f, isPrivate }))
                }
              />
            )}

            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={saving}
              onClick={() => setMakingRule(true)}
            >
              <Wand2 aria-hidden /> {tn('makeRule')}
            </Button>
            <p className="-mt-3 px-1 text-xs text-on-surface-variant">
              {tn('makeRuleHint')}
            </p>

            {submitError ? (
              <p role="alert" className="text-sm text-expense">
                {submitError}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? tn('saving') : tn('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
