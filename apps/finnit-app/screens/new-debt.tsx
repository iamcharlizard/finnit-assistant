import * as React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'urql';

import {
  createOtherDebt,
  debtErrorMessage,
  saveCardInstallments,
  saveLoan,
} from '@finnit/core/debts/api';
import {
  newCardInstallmentForm,
  validateCardInstallmentForm,
  withCardInstallmentChange,
  withScheduleRowChange,
  type CardInstallmentErrors,
  type CardInstallmentForm,
} from '@finnit/core/debts/card-installments';
import {
  hasErrors,
  newDebtForm,
  validateDebtForm,
  type DebtForm,
  type DebtFormErrors,
} from '@finnit/core/debts/form';
import {
  newLoanForm,
  validateLoanForm,
  withDefaultPaymentCategory,
  withLoanType,
  type LoanForm,
  type LoanFormErrors,
} from '@finnit/core/debts/loan-form';
import {
  NEW_DEBT_FORM_QUERY,
  type NewDebtFormResult,
} from '@finnit/core/debts/request';
import {
  LOAN_TYPES,
  NEW_DEBT_KINDS,
  type LoanFormType,
  type NewDebtKind,
} from '@finnit/core/debts/types';
import { todayKey } from '@finnit/core/finance/dates';
import { TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';
import { ToggleGroup } from '@finnit/ui-native/components/ui/toggle-group';

import { CardInstallmentFields } from '@/components/debts/card-installment-fields';
import { LoanFields } from '@/components/debts/loan-fields';
import { OtherDebtFields } from '@/components/debts/other-debt-fields';
import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';
import { appHref } from '@/lib/nav/app-href';
import { emitTransactionsChanged } from '@/lib/transactions/events';

const isLoanKind = (kind: string): kind is LoanFormType =>
  (LOAN_TYPES as readonly string[]).includes(kind);

const isNewDebtKind = (kind: string | undefined): kind is NewDebtKind =>
  Boolean(kind) && (NEW_DEBT_KINDS as readonly string[]).includes(kind!);

/**
 * "Nueva deuda" (the web's NewDebtDialog): a loan by type, a purchase on a
 * credit card in monthly installments, or any other debt. Opened from an
 * expense ("Crear compra a meses con este gasto") it comes filled with
 * it: `?kind=card_installments&account=&amount=&date=&name=&tx=`.
 */
export function NewDebtScreen() {
  const params = useLocalSearchParams<Params>();
  const [{ data }] = useQuery<NewDebtFormResult>({
    query: NEW_DEBT_FORM_QUERY,
    requestPolicy: 'cache-and-network',
  });
  // The form starts once the accounts are here: the card's cut-offs give
  // the installments already billed.
  return data ? (
    <NewDebtForm data={data} params={params} />
  ) : (
    <ActivityIndicator style={{ marginTop: 48 }} />
  );
}

type Params = {
  kind?: string;
  account?: string;
  amount?: string;
  date?: string;
  name?: string;
  tx?: string;
};

function NewDebtForm({
  data,
  params,
}: {
  data: NewDebtFormResult;
  params: Params;
}) {
  const l = useLocalizer();
  const { t } = l;
  const router = useRouter();
  const gql = useGql();
  const insets = useSafeAreaInsets();
  const today = todayKey();
  const accounts = React.useMemo(
    () => data.accounts.edges.map((e) => e.node),
    [data],
  );
  const categories = data.categories;

  const [kind, setKind] = React.useState<NewDebtKind>(
    isNewDebtKind(params.kind) ? params.kind : 'institutional',
  );
  const [loan, setLoan] = React.useState<LoanForm>(() =>
    withDefaultPaymentCategory(newLoanForm(), categories),
  );
  const [loanErrors, setLoanErrors] = React.useState<LoanFormErrors>({});
  const [card, setCard] = React.useState<CardInstallmentForm>(() =>
    withCardInstallmentChange(
      newCardInstallmentForm(today, {
        name: params.name,
        accountId: params.account,
        principal: params.amount,
        purchaseDate: params.date,
        purchaseTransactionId: params.tx,
      }),
      {},
      { accounts, today },
    ),
  );
  const [cardErrors, setCardErrors] = React.useState<CardInstallmentErrors>({});
  const [other, setOther] = React.useState<DebtForm>(() => ({
    ...newDebtForm(),
    kind: 'other',
  }));
  const [otherErrors, setOtherErrors] = React.useState<DebtFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const clear = <T extends object>(
    set: React.Dispatch<React.SetStateAction<T>>,
    patch: object,
  ) =>
    set((current) => {
      const next = { ...current } as Record<string, unknown>;
      for (const key of Object.keys(patch)) delete next[key];
      return next as T;
    });

  function pickKind(next: NewDebtKind) {
    setKind(next);
    setSubmitError(null);
    if (isLoanKind(next) && next !== loan.loanType) {
      setLoan(
        withDefaultPaymentCategory(
          withLoanType(loan, next),
          categories,
          loan.loanType,
        ),
      );
    }
  }

  async function save(run: () => Promise<string>, name: string) {
    setSaving(true);
    setSubmitError(null);
    try {
      const id = await run();
      toast.success(t('debts.toasts.created', { name }));
      emitTransactionsChanged();
      if (params.tx) router.back();
      else router.replace(appHref(`/planning/debts/${id}`));
    } catch (error) {
      setSubmitError(debtErrorMessage(error, t));
      setSaving(false);
    }
  }

  function submit() {
    if (kind === 'card_installments') {
      const found = validateCardInstallmentForm(card, { today });
      setCardErrors(found);
      if (!hasErrors(found))
        void save(() => saveCardInstallments(card, gql), card.name.trim());
      return;
    }
    if (kind === 'other') {
      const found = validateDebtForm(other);
      setOtherErrors(found);
      if (!hasErrors(found))
        void save(() => createOtherDebt(other, gql), other.name.trim());
      return;
    }
    const found = validateLoanForm(loan, { today, detectedPayments: 0 });
    setLoanErrors(found);
    if (!hasErrors(found))
      void save(() => saveLoan(loan, null, gql), loan.name.trim());
  }

  const errors =
    kind === 'card_installments'
      ? cardErrors
      : kind === 'other'
        ? otherErrors
        : loanErrors;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <TwScrollView
        keyboardShouldPersistTaps="handled"
        className="flex-1 bg-popover"
        contentContainerClassName="gap-4 px-5 pt-6"
        contentContainerStyle={{ paddingBottom: Math.max(24, insets.bottom) }}
      >
        <TwView className="gap-1">
          <Text accessibilityRole="header" weight="bold" className="text-lg">
            {t('debts.newTitle')}
          </Text>
          <Text className="text-sm text-on-surface-variant">
            {t('debts.newDescription')}
          </Text>
        </TwView>

        <TwView className="gap-2">
          <Text weight="medium" className="px-1 text-sm">
            {t('debts.newKindLabel')}
          </Text>
          <ToggleGroup
            accessibilityLabel={t('debts.newKindLabel')}
            value={kind}
            options={NEW_DEBT_KINDS.map((value) => ({
              value,
              label: t(`debts.newKinds.${value}`),
            }))}
            onValueChange={pickKind}
          />
          <Text className="px-1 text-xs text-on-surface-variant">
            {t(`debts.newKindHints.${kind}`)}
          </Text>
        </TwView>

        {kind === 'card_installments' ? (
          <CardInstallmentFields
            form={card}
            errors={cardErrors}
            update={(patch) => {
              setCard((current) =>
                withCardInstallmentChange(current, patch, { accounts, today }),
              );
              clear(setCardErrors, patch);
            }}
            updateRow={(index, patch) => {
              setCard((current) =>
                withScheduleRowChange(current, index, patch, {
                  accounts,
                  today,
                }),
              );
              clear(setCardErrors, { schedule: null });
            }}
            accounts={accounts}
            today={today}
          />
        ) : kind === 'other' ? (
          <OtherDebtFields
            form={other}
            errors={otherErrors}
            update={(patch) => {
              setOther((current) => ({ ...current, ...patch }));
              clear(setOtherErrors, patch);
            }}
            accounts={accounts}
          />
        ) : (
          <LoanFields
            form={loan}
            errors={loanErrors}
            update={(patch) => {
              setLoan((current) => ({ ...current, ...patch }));
              clear(setLoanErrors, patch);
            }}
            accounts={accounts}
            today={today}
          />
        )}

        {hasErrors(errors) ? (
          <Text accessibilityRole="alert" className="text-[13px] text-expense">
            {t('debts.loan.fixErrors')}
          </Text>
        ) : null}
        {submitError ? (
          <Text accessibilityRole="alert" className="text-[13px] text-expense">
            {submitError}
          </Text>
        ) : null}

        <TwView className="flex-row gap-3">
          <Button
            variant="outline"
            label={t('common.cancel')}
            onPress={() => router.back()}
            disabled={saving}
            className="flex-1"
          />
          <Button
            label={
              saving
                ? t('debts.loan.saving')
                : kind === 'card_installments'
                  ? t('debts.cardInstallments.create')
                  : kind === 'other'
                    ? t('debts.form.create')
                    : t('debts.loan.create')
            }
            onPress={submit}
            disabled={saving}
            className="flex-1"
          />
        </TwView>
      </TwScrollView>
    </KeyboardAvoidingView>
  );
}
