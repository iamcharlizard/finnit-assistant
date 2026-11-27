import * as React from 'react';
import { useTranslations } from 'use-intl';
import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react-native';

import { budgetCategoryOptions } from '@finnit/core/budgets/options';
import type { BudgetCategory } from '@finnit/core/budgets/types';
import { previewAllocation, type PaymentSurplus, type PendingPayment } from '@finnit/core/debts/allocation';
import { debtErrorMessage, registerDebtPayment } from '@finnit/core/debts/api';
import {
  buildPaymentMovement,
  hasErrors,
  newPaymentForm,
  paymentMode,
  paymentSources,
  validatePaymentForm,
  type PaymentErrorCode,
  type PaymentForm,
  type PaymentFormErrors,
} from '@finnit/core/debts/form';
import { linkLoanPayment } from '@finnit/core/debts/links';
import type { ApiDebt } from '@finnit/core/debts/types';
import { accountLabel } from '@finnit/core/finance/accounts';
import type { DayKey } from '@finnit/core/finance/dates';
import { DEFAULT_CURRENCY, formatMoney, roundCents } from '@finnit/core/finance/money';
import type { ApiAccount } from '@finnit/core/finance/types';
import { parseAmount } from '@finnit/core/new-entry/form';
import { accountOptions } from '@finnit/core/new-entry/options';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Checkbox } from '@finnit/ui-native/components/ui/checkbox';
import { DatePicker } from '@finnit/ui-native/components/ui/date-picker';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { Select } from '@finnit/ui-native/components/ui/select';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';
import { ToggleGroup } from '@finnit/ui-native/components/ui/toggle-group';

import { ExpensePicker } from '@/components/loan-links/expense-picker';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/**
 * The web's PaymentDialog: a payment of a loan (an expense, or a transfer
 * to its linked card). With `installment` it pays that scheduled payment,
 * or links an expense already recorded ("Gasto existente"). Purchase
 * financing and personal loans pick the pending payments it covers
 * (`pending`; none = a payment to the balance) and see what falls short or
 * is left over before saving. Mounted while open.
 */
export function PaymentSheet({
  debt,
  remainingLabel,
  installment,
  pending,
  accounts,
  categories,
  today,
  onClose,
  onSaved,
}: {
  debt: ApiDebt;
  remainingLabel: string;
  installment?: { occurrenceId: string; amount: number; dateLabel: string; amountLabel: string };
  pending?: PendingPayment[];
  accounts: ApiAccount[];
  categories: BudgetCategory[];
  today: DayKey;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tf = useTranslations('debts.payment');
  const ta = useTranslations('debts.payment.allocation');
  const tl = useTranslations('debts.links');
  const { t, locale } = useLocalizer();
  const gql = useGql();
  const mode = React.useMemo(() => paymentMode(debt, accounts), [debt, accounts]);
  const sources = React.useMemo(() => paymentSources(mode, accounts), [mode, accounts]);
  const allocating = Boolean(pending) && mode.kind === 'expense';

  const [linking, setLinking] = React.useState(false);
  const [linkedId, setLinkedId] = React.useState<string | null>(null);
  const [chosen, setChosen] = React.useState<string[]>(() =>
    pending ? (installment ? [installment.occurrenceId] : pending.slice(0, 1).map((p) => p.occurrenceId)) : [],
  );
  const [surplus, setSurplus] = React.useState<PaymentSurplus>('next');
  const [amountTyped, setAmountTyped] = React.useState(false);
  const chosenDue = (ids: string[]) =>
    roundCents((pending ?? []).filter((p) => ids.includes(p.occurrenceId)).reduce((sum, p) => sum + p.due, 0));
  const [form, setForm] = React.useState<PaymentForm>(() =>
    newPaymentForm(
      pending && chosen.length > 0
        ? { ...debt, minPaymentAmount: chosenDue(chosen) }
        : installment
          ? { ...debt, minPaymentAmount: installment.amount }
          : debt.installmentAmount != null
            ? { ...debt, minPaymentAmount: debt.installmentAmount }
            : debt,
      { today, accountId: sources.length === 1 ? sources[0]!.id : '' },
    ),
  );
  const [errors, setErrors] = React.useState<PaymentFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const money = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  const errorText = (code: PaymentErrorCode | undefined) => (code ? t(`debts.paymentValidation.${code}`) : undefined);
  const sourceItems = React.useMemo(() => accountOptions(sources).map(({ value, label }) => ({ value, label })), [sources]);
  const categoryItems = React.useMemo(
    () =>
      budgetCategoryOptions(categories, locale).map((o) => ({
        value: o.value,
        label: o.label,
        hint: o.group && o.group !== o.label ? o.group : undefined,
      })),
    [categories, locale],
  );
  const amount = parseAmount(form.amount);
  const preview = allocating && amount !== null ? previewAllocation(amount, pending!, chosen, surplus) : null;

  function update(patch: Partial<PaymentForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof PaymentForm];
      return next;
    });
  }

  function toggle(id: string, on: boolean) {
    const ids = on ? [...chosen, id] : chosen.filter((other) => other !== id);
    setChosen(ids);
    if (!amountTyped && ids.length > 0) update({ amount: String(chosenDue(ids)) });
  }

  async function save() {
    if (linking) {
      if (!installment || !linkedId) return;
      setSaving(true);
      setSubmitError(null);
      try {
        await linkLoanPayment(installment.occurrenceId, linkedId, gql);
        onSaved();
      } catch (error) {
        setSubmitError(debtErrorMessage(error, t));
        setSaving(false);
      }
      return;
    }
    const found = validatePaymentForm(form, { remaining: debt.remainingBalance, today });
    setErrors(found);
    const account = sources.find((a) => a.id === form.accountId);
    if (hasErrors(found) || !account) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await registerDebtPayment(
        debt.id,
        buildPaymentMovement(form, { debt, mode, account, description: tf('movementDescription', { name: debt.name }) }),
        gql,
        allocating ? { occurrenceIds: chosen, surplus } : { occurrenceId: installment?.occurrenceId },
      );
      onSaved();
    } catch (error) {
      setSubmitError(debtErrorMessage(error, t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={tf('title')}
      description={tf('description', { name: debt.name, amount: remainingLabel })}
      closeLabel={t('common.close')}
      footer={
        linking ? (
          <Button label={saving ? tl('saving') : tl('expense.submit')} onPress={() => void save()} disabled={saving || !linkedId} className="w-full" />
        ) : (
          <Button label={saving ? tf('saving') : tf('submit')} onPress={() => void save()} disabled={saving || sources.length === 0} className="w-full" />
        )
      }
    >
      <TwView className="gap-4 pb-2">
        {installment ? (
          <ToggleGroup
            options={[
              { value: 'new', label: tl('mode.new') },
              { value: 'existing', label: tl('mode.existing') },
            ]}
            value={linking ? 'existing' : 'new'}
            onValueChange={(value) => {
              setLinking(value === 'existing');
              setSubmitError(null);
            }}
            accessibilityLabel={tl('mode.label')}
          />
        ) : null}

        {linking && installment ? (
          <>
            <Text className="text-sm text-on-surface-variant">
              {tl('expense.description', { date: installment.dateLabel, amount: installment.amountLabel })}
            </Text>
            <ExpensePicker occurrenceId={installment.occurrenceId} today={today} value={linkedId} onChange={setLinkedId} />
          </>
        ) : (
          <>
            {mode.kind === 'transfer' ? (
              <Note icon={Info}>{tf('transferNote', { card: accountLabel(mode.card) })}</Note>
            ) : null}

            {allocating && pending!.length > 0 ? (
              <TwView className="gap-2">
                <Text weight="medium" className="text-sm">
                  {ta('title')}
                </Text>
                <Text className="text-xs text-on-surface-variant">{ta('hint')}</Text>
                <TwView className="rounded-input border border-input">
                  {pending!.map((p, index) => (
                    <TwView key={p.occurrenceId} className={cn('flex-row items-center gap-3 px-3 py-2', index > 0 && 'border-t border-glass-border')}>
                      <Checkbox
                        checked={chosen.includes(p.occurrenceId)}
                        onCheckedChange={(on) => toggle(p.occurrenceId, on)}
                        label={p.dateLabel}
                        hideLabel
                      />
                      <TwView className="min-w-0 flex-1">
                        <Text className="text-sm">{p.dateLabel}</Text>
                        {p.concepts.length > 0 ? (
                          <Text numberOfLines={1} className="text-xs text-on-surface-variant">
                            {p.concepts.join(' · ')}
                          </Text>
                        ) : null}
                      </TwView>
                      <Text className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>
                        {ta('due', { amount: money(p.due) })}
                      </Text>
                    </TwView>
                  ))}
                </TwView>
                {chosen.length === 0 ? (
                  <Note icon={Info}>{ta('abonoNote')}</Note>
                ) : preview && preview.shortfall > 0 ? (
                  <Note icon={AlertTriangle} warning>
                    {ta('shortfall', { amount: money(preview.shortfall), date: preview.partial?.dateLabel ?? '' })}
                  </Note>
                ) : preview && preview.surplus > 0 ? (
                  <TwView className="gap-2">
                    <Note icon={AlertTriangle} warning>
                      {ta('surplus', { amount: money(preview.surplus) })}
                    </Note>
                    <ToggleGroup
                      options={[
                        { value: 'next', label: ta('surplusNext') },
                        { value: 'balance', label: ta('surplusBalance') },
                      ]}
                      value={surplus}
                      onValueChange={setSurplus}
                      accessibilityLabel={ta('surplus', { amount: money(preview.surplus) })}
                    />
                  </TwView>
                ) : preview ? (
                  <Note icon={CheckCircle2}>{ta('exact')}</Note>
                ) : null}
              </TwView>
            ) : null}

            <MoneyInput
              label={tf('amount')}
              value={form.amount}
              onValueChange={(value) => {
                setAmountTyped(true);
                update({ amount: value });
              }}
              error={errorText(errors.amount)}
            />
            <DatePicker
              label={tf('date')}
              value={form.date || undefined}
              onChange={(day) => update({ date: day ?? '' })}
              max={today}
              locale={locale}
              error={errorText(errors.date)}
              closeLabel={t('common.close')}
            />
            {sources.length > 0 ? (
              <Select
                label={tf('account')}
                title={tf('account')}
                options={sourceItems}
                value={form.accountId || null}
                onValueChange={(accountId) => update({ accountId })}
                placeholder={tf('accountPlaceholder')}
                searchable
                searchPlaceholder={tf('accountSearch')}
                emptyLabel={tf('noResults')}
                error={errorText(errors.accountId)}
                closeLabel={t('common.close')}
              />
            ) : (
              <Text accessibilityRole="alert" className="text-[13px] text-expense">
                {mode.kind === 'transfer' ? tf('noSourcesTransfer') : tf('noSources')}
              </Text>
            )}
            {mode.kind === 'expense' ? (
              <Select
                label={tf('category')}
                title={tf('category')}
                options={categoryItems}
                value={form.categoryId || null}
                onValueChange={(categoryId) => update({ categoryId })}
                placeholder={tf('categoryPlaceholder')}
                searchable
                searchPlaceholder={tf('categorySearch')}
                emptyLabel={tf('noResults')}
                closeLabel={t('common.close')}
              />
            ) : null}
          </>
        )}
        {submitError ? (
          <Text accessibilityRole="alert" className="text-[13px] text-expense">
            {submitError}
          </Text>
        ) : null}
      </TwView>
    </Sheet>
  );
}

function Note({ icon, warning, children }: { icon: LucideIcon; warning?: boolean; children: React.ReactNode }) {
  return (
    <TwView className={cn('flex-row items-start gap-2 rounded-input p-3', warning ? 'bg-highlight-10' : 'bg-track')}>
      <Icon icon={icon} size={16} color={warning ? '--highlight' : '--on-surface-variant'} />
      <Text className="flex-1 text-xs">{children}</Text>
    </TwView>
  );
}
