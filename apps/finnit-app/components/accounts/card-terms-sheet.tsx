import * as React from 'react';
import { useTranslations } from 'use-intl';

import { SET_CREDIT_CARD_TERMS_MUTATION } from '@finnit/core/accounts/api';
import {
  buildCreditTermsInput,
  creditTermsErrors,
} from '@finnit/core/accounts/form';
import { requestErrorMessage } from '@finnit/core/graphql/request';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { NumberInput } from '@finnit/ui-native/components/ui/number-input';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/**
 * A credit card's cut-off and payment days and annual rate (the web edits
 * them in "Editar"): its billing cycles and reminders come from them.
 */
export function CardTermsSheet({
  accountId,
  initial,
  onClose,
  onSaved,
}: {
  accountId: string;
  initial: {
    statementDay: number | null;
    paymentDueDay: number | null;
    interestRateAnnual: number | null;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('accounts.wizard');
  const te = useTranslations('accounts.errors');
  const l = useLocalizer();
  const gql = useGql();
  const [form, setForm] = React.useState({
    statementDay: initial.statementDay ? String(initial.statementDay) : '',
    paymentDueDay: initial.paymentDueDay ? String(initial.paymentDueDay) : '',
    interestRate:
      initial.interestRateAnnual != null
        ? String(initial.interestRateAnnual)
        : '',
  });
  const [tried, setTried] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const errors = tried ? creditTermsErrors(form) : {};
  const message = (code?: string) => (code ? te(code as 'day') : undefined);

  async function save() {
    setTried(true);
    if (Object.keys(creditTermsErrors(form)).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      await gql(SET_CREDIT_CARD_TERMS_MUTATION, {
        accountId,
        input: buildCreditTermsInput(form),
      });
      onSaved();
    } catch (e) {
      setError(requestErrorMessage(e, l.t));
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => !next && !saving && onClose()}
      title={l.t('cards.period.terms')}
      closeLabel={l.t('common.close')}
    >
      <TwView className="gap-4 pb-2">
        <TwView className="flex-row gap-3">
          <NumberInput
            className="flex-1"
            label={t('statementDay')}
            maxDigits={2}
            placeholder={t('dayPlaceholder')}
            value={form.statementDay}
            onValueChange={(statementDay) =>
              setForm((f) => ({ ...f, statementDay }))
            }
            error={message(errors.statementDay)}
          />
          <NumberInput
            className="flex-1"
            label={t('paymentDueDay')}
            maxDigits={2}
            placeholder={t('dayPlaceholder')}
            value={form.paymentDueDay}
            onValueChange={(paymentDueDay) =>
              setForm((f) => ({ ...f, paymentDueDay }))
            }
            error={message(errors.paymentDueDay)}
          />
        </TwView>
        <NumberInput
          decimals={4}
          suffix="%"
          label={t('interestRate')}
          placeholder={t('interestRatePlaceholder')}
          value={form.interestRate}
          onValueChange={(interestRate) =>
            setForm((f) => ({ ...f, interestRate }))
          }
          error={message(errors.interestRate)}
        />
        {error ? <Text className="text-sm text-expense">{error}</Text> : null}
        <Button
          label={l.t('cards.period.saveTerms')}
          disabled={saving}
          onPress={() => void save()}
          className="w-full"
        />
      </TwView>
    </Sheet>
  );
}
