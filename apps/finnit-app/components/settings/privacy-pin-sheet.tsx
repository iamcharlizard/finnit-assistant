import * as React from 'react';
import { useTranslations } from 'use-intl';

import { requestErrorMessage } from '@finnit/core/graphql/request';
import { PIN_MAX, PIN_MIN, isValidPin } from '@finnit/core/privacy/pin';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

const SET_PIN_MUTATION = `mutation SetPrivacyPin($input: SetPrivacyPinInput!) { setPrivacyPin(input: $input) }`;

const pinText = (value: string) => value.replace(/\D/g, '').slice(0, PIN_MAX);

/** Creates or changes the privacy PIN (the current one is asked to change it). */
export function PrivacyPinSheet({ hasPin, onClose, onSaved }: { hasPin: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('privacy.pinDialog');
  const l = useLocalizer();
  const gql = useGql();
  const [current, setCurrent] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [repeat, setRepeat] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (!isValidPin(pin)) return setError(t('errors.length', { min: PIN_MIN, max: PIN_MAX }));
    if (pin !== repeat) return setError(t('errors.mismatch'));
    if (hasPin && !current) return setError(t('errors.current'));
    setSaving(true);
    setError(null);
    try {
      await gql(SET_PIN_MUTATION, { input: { pin, currentPin: hasPin ? current : null } });
      toast.success(t(hasPin ? 'changed' : 'created'));
      onSaved();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(
        /wrong pin/i.test(message)
          ? t('errors.wrongCurrent')
          : /too many/i.test(message)
            ? l.t('privacy.unlock.errors.paused')
            : requestErrorMessage(e, l.t),
      );
      setSaving(false);
    }
  }

  const field = (label: string, value: string, onChange: (v: string) => void, autoFocus?: boolean) => (
    <Input label={label} value={value} onChangeText={(v) => onChange(pinText(v))} keyboardType="number-pad" secureTextEntry autoFocus={autoFocus} textContentType="oneTimeCode" />
  );

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={t(hasPin ? 'changeTitle' : 'createTitle')}
      description={t('description', { min: PIN_MIN, max: PIN_MAX })}
      closeLabel={l.t('common.close')}
      className="gap-4"
    >
      {hasPin ? field(t('current'), current, setCurrent, true) : null}
      {field(t('new'), pin, setPin, !hasPin)}
      {field(t('repeat'), repeat, setRepeat)}
      {error ? (
        <Text accessibilityRole="alert" className="text-[13px] text-expense">
          {error}
        </Text>
      ) : null}
      <TwView>
        <Button label={saving ? t('saving') : t('save')} onPress={submit} disabled={saving} className="w-full" />
      </TwView>
    </Sheet>
  );
}
