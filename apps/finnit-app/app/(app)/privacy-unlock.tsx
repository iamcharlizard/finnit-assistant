import * as React from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { LockKeyhole } from 'lucide-react-native';

import { isValidPin } from '@finnit/core/privacy/pin';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useAuth } from '@/contexts/AuthContext';
import { useGql } from '@/lib/graphql/runner';
import { savePrivacyUnlock } from '@/lib/session/storage';
import { emitTransactionsChanged } from '@/lib/transactions/events';

type UnlockError = 'invalid' | 'wrong' | 'paused' | 'noPin' | 'failed';

const UNLOCK_MUTATION = 'mutation UnlockPrivacy($pin: String!) { unlockPrivacy(pin: $pin) { token expiresAt } }';

/**
 * The privacy PIN (the web's PrivacyUnlockDialog): the API's unlock token
 * is kept in secure storage until it expires (10 minutes) and sent with
 * every request, so protected names and bank texts show meanwhile.
 */
export default function PrivacyUnlock() {
  const t = useTranslations('privacy.unlock');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gql = useGql();
  const { refreshUser } = useAuth();
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState<UnlockError | null>(null);
  const [checking, setChecking] = React.useState(false);

  async function submit() {
    if (!isValidPin(pin)) {
      setError('invalid');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const { unlockPrivacy } = await gql<{ unlockPrivacy: { token: string; expiresAt: string } }>(UNLOCK_MUTATION, { pin });
      await savePrivacyUnlock(unlockPrivacy.token, unlockPrivacy.expiresAt);
      emitTransactionsChanged();
      void refreshUser();
      router.back();
    } catch (e) {
      const message = (e as Error).message ?? '';
      setError(
        /wrong pin/i.test(message) ? 'wrong' : /too many/i.test(message) ? 'paused' : /no privacy pin/i.test(message) ? 'noPin' : 'failed',
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <TwView className="gap-4 bg-popover px-5 pt-6" style={{ paddingBottom: Math.max(24, insets.bottom) }}>
      <TwView className="flex-row items-center gap-2">
        <Icon icon={LockKeyhole} size={20} color="--brand-ink" />
        <Text accessibilityRole="header" weight="bold" className="text-lg">
          {t('title')}
        </Text>
      </TwView>
      <Text className="text-sm text-on-surface-variant">{t('description')}</Text>
      <Input
        label={t('pin')}
        value={pin}
        onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 8))}
        keyboardType="number-pad"
        secureTextEntry
        autoFocus
        textContentType="oneTimeCode"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error ? t(`errors.${error}`) : undefined}
      />
      <Button label={checking ? t('checking') : t('confirm')} onPress={submit} disabled={checking} className="w-full" />
    </TwView>
  );
}
