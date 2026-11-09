import * as React from 'react';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import {
  Landmark,
  Languages,
  LockKeyhole,
  LockKeyholeOpen,
  LogOut,
  Moon,
  Paintbrush,
  Shapes,
  ShieldCheck,
  Tags,
  Text as TextIcon,
  Type,
} from 'lucide-react-native';

import { LOCALES, type Locale } from '@finnit/core/i18n/locales';
import { TwView } from '@finnit/ui-native/lib/tw';
import { ProfileCard } from '@finnit/ui-native/components/settings/profile-card';
import { SettingRow } from '@finnit/ui-native/components/settings/setting-row';
import { SettingsSection } from '@finnit/ui-native/components/settings/settings-section';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Text } from '@finnit/ui-native/components/ui/text';
import { toast } from '@finnit/ui-native/components/ui/toaster';

import { PrivacyPinSheet } from '@/components/settings/privacy-pin-sheet';
import { Screen } from '@/components/shell/screen';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/lib/i18n/i18n-provider';
import { avatarSource } from '@/lib/profile/avatar';
import { savePrivacyUnlock } from '@/lib/session/storage';
import {
  useAppearance,
  type AppearancePreference,
} from '@/lib/theme/appearance';
import { emitTransactionsChanged } from '@/lib/transactions/events';

/** Configuración: banks, categories and names, security, language and appearance, sign out. */
export function SettingsScreen() {
  const t = useTranslations('settings');
  const tp = useTranslations('privacy.settings');
  const tm = useTranslations('ui.mode');
  const tpm = useTranslations('profileMenu');
  const router = useRouter();
  const { user, logout, saveLocale, refreshUser } = useAuth();
  const { locale } = useLocale();
  const { appearance, setAppearance } = useAppearance();
  const [pinOpen, setPinOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  if (!user) return null;
  const hasPin = user.privacy.hasPin;

  async function changeLanguage(next: Locale) {
    if (next === locale) return;
    try {
      await saveLocale(next);
    } catch {
      toast.error(t('languageError'));
    }
  }

  return (
    <Screen title={tpm('settings')}>
      <TwView className="gap-4">
        <ProfileCard
          name={user.name}
          email={user.email}
          avatarSource={avatarSource(user.avatar)}
        />

        <SettingsSection
          title={t('banks')}
          icon={Landmark}
          iconColor="var(--brand)"
        >
          <SettingRow
            label={t('connectedBanks')}
            description={t('connectedBanksDescription')}
            icon={Landmark}
            onPress={() => router.push('/connect-bank')}
          />
        </SettingsSection>

        <SettingsSection
          title={t('movements')}
          icon={Tags}
          iconColor="var(--highlight)"
        >
          <SettingRow
            label={t('categories')}
            description={t('categoriesDescription')}
            icon={Shapes}
            onPress={() => router.push('/settings/categories')}
          />
          <SettingRow
            label={t('aliases')}
            description={t('aliasesDescription')}
            icon={TextIcon}
            onPress={() => router.push('/settings/aliases')}
          />
          <SettingRow
            label={t('categorize')}
            description={t('categorizeDescription')}
            icon={Tags}
            onPress={() =>
              router.navigate({ pathname: '/history', params: { review: '1' } })
            }
          />
        </SettingsSection>

        <SettingsSection
          title={t('security')}
          icon={ShieldCheck}
          iconColor="var(--tertiary)"
        >
          <SettingRow
            label={tp(hasPin ? 'change' : 'create')}
            description={tp('hint')}
            icon={LockKeyhole}
            onPress={() => setPinOpen(true)}
          />
          {hasPin && user.privacy.unlocked ? (
            <TwView className="flex-row justify-end px-1">
              <Button
                variant="outline"
                size="sm"
                icon={LockKeyholeOpen}
                label={tp('lockNow')}
                onPress={async () => {
                  await savePrivacyUnlock(null);
                  emitTransactionsChanged();
                  await refreshUser();
                }}
              />
            </TwView>
          ) : null}
        </SettingsSection>

        <SettingsSection
          title={t('appearance')}
          icon={Paintbrush}
          iconColor="var(--highlight)"
        >
          <SettingRow label={t('language')} icon={Languages}>
            <Segmented
              accessibilityLabel={t('language')}
              className="w-40"
              options={LOCALES.map((value) => ({
                value,
                label: t(`languages.${value}`),
              }))}
              value={locale}
              onValueChange={(next) => void changeLanguage(next)}
            />
          </SettingRow>
          <TwView className="gap-2 rounded-xl bg-track px-3 py-3">
            <TwView className="flex-row items-center gap-3">
              <Icon icon={Moon} size={20} color="--on-surface-variant" />
              <Text className="text-base text-on-surface-variant">
                {t('colorMode')}
              </Text>
            </TwView>
            <Segmented
              accessibilityLabel={t('colorMode')}
              options={(
                ['light', 'dark', 'system'] as AppearancePreference[]
              ).map((value) => ({
                value,
                label: value === 'system' ? tpm('systemMode') : tm(value),
              }))}
              value={appearance}
              onValueChange={setAppearance}
            />
          </TwView>
          <SettingRow label={t('font')} icon={Type}>
            <Text weight="medium" className="text-[13px] text-highlight">
              Ubuntu
            </Text>
          </SettingRow>
        </SettingsSection>

        <Button
          variant="destructive"
          size="lg"
          icon={LogOut}
          label={signingOut ? tpm('signingOut') : t('signOut')}
          disabled={signingOut}
          className="mt-4 rounded-[20px]"
          onPress={async () => {
            setSigningOut(true);
            await logout();
          }}
        />
        <Text className="text-center text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
          {t('version')}
        </Text>
        {pinOpen ? (
          <PrivacyPinSheet
            hasPin={hasPin}
            onClose={() => setPinOpen(false)}
            onSaved={() => {
              setPinOpen(false);
              void refreshUser();
            }}
          />
        ) : null}
      </TwView>
    </Screen>
  );
}
