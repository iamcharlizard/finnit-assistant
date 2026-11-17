'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

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
import { toast } from '@finnit/ui/components/ui/toaster';
import { useDialogExit } from '@finnit/ui/lib/use-dialog-exit';

import { SwitchField } from '@/components/finance/switch-field';
import {
  DIRECTION_NAME_MAX,
  DIRECTION_PATTERN_MAX,
  buildDirectionInput,
  changeDirection,
  newDirectionForm,
  validateDirectionForm,
  type DirectionChange,
  type DirectionErrors,
  type DirectionForm,
} from '@finnit/core/transaction-detail/direction';
import { formatMoney } from '@finnit/core/finance/money';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * "Es un ingreso" / "Es un gasto": records the movement the other way
 * round and, if asked, does the same with the movements whose bank text
 * contains a pattern (an automatic name keeps doing it on the next
 * syncs). Mounted while open.
 */
export function DirectionDialog({
  change,
  account,
  onClose,
  onChanged,
}: {
  change: DirectionChange;
  /** "BBVA Débito" */
  account: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const exit = useDialogExit();
  const { t, locale } = useLocalizer();
  const amount = formatMoney(change.amount, change.currency, locale);
  const td = useTranslations('transaction.direction');
  const [form, setForm] = React.useState<DirectionForm>(() =>
    newDirectionForm(change),
  );
  const [errors, setErrors] = React.useState<DirectionErrors>({});
  const [saving, setSaving] = React.useState(false);
  const income = change.to === 'income';
  const update = (patch: Partial<DirectionForm>) =>
    setForm((current) => ({ ...current, ...patch }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateDirectionForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const more = await changeDirection(
        buildDirectionInput(change, form),
        gql,
      );
      toast.success(td(income ? 'doneIncome' : 'doneExpense'), {
        description: more > 0 ? td('doneMore', { count: more }) : undefined,
      });
      exit.after(onChanged)();
    } catch (error) {
      toast.error(requestErrorMessage(error, t));
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
        className="sm:max-w-md"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>
              {td(income ? 'titleIncome' : 'titleExpense')}
            </DialogTitle>
            <DialogDescription>
              {td(income ? 'descriptionIncome' : 'descriptionExpense', {
                amount,
                account,
              })}{' '}
              {td('bankNote')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <SwitchField
              label={td('remember')}
              hint={td(income ? 'rememberHintIncome' : 'rememberHintExpense')}
              checked={form.remember}
              onCheckedChange={(remember) => update({ remember })}
            />
            {form.remember ? (
              <>
                <Input
                  label={td('pattern')}
                  value={form.pattern}
                  maxLength={DIRECTION_PATTERN_MAX}
                  autoComplete="off"
                  onChange={(e) => update({ pattern: e.target.value })}
                  error={
                    errors.pattern ? td(`errors.${errors.pattern}`) : undefined
                  }
                />
                <Input
                  label={td('name')}
                  value={form.displayName}
                  maxLength={DIRECTION_NAME_MAX}
                  autoComplete="off"
                  onChange={(e) => update({ displayName: e.target.value })}
                  error={
                    errors.displayName
                      ? td(`errors.${errors.displayName}`)
                      : undefined
                  }
                />
              </>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saving}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" variant="secondary" disabled={saving}>
              {saving ? td('saving') : td('confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
