'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  BellRing,
  ChevronRight,
  Fingerprint,
  Landmark,
  Lock,
  LogOut,
  Moon,
  Paintbrush,
  Shapes,
  ShieldCheck,
  Tags,
  Text,
  Type,
  UserCog,
} from 'lucide-react';

import { ProfileCard } from '@finnit/ui/components/settings/profile-card';
import { SettingRow } from '@finnit/ui/components/settings/setting-row';
import { SettingsSection } from '@finnit/ui/components/settings/settings-section';
import { Button } from '@finnit/ui/components/ui/button';
import { Switch } from '@finnit/ui/components/ui/switch';

import { signOut } from '@/app/login/actions';
import { useSessionUser } from '@/components/session-provider';
import { ProfileDialog } from '@/components/settings/profile-dialog';
import { PrivacySettings } from '@/components/privacy/privacy-settings';
import { avatarSrc } from '@/lib/profile/avatar';
import { LanguageSelect } from '@/components/settings/language-select';
import { ModeSegmented } from '@/components/mode-segmented';
import { ThemeSelect } from '@/components/settings/theme-select';

export function SettingsScreen() {
  const user = useSessionUser();
  const t = useTranslations('settings');
  const tu = useTranslations('ui.profile');
  const [editingProfile, setEditingProfile] = React.useState(false);
  const [toggles, setToggles] = React.useState({
    biometrics: true,
    transactions: true,
    weeklySummary: false,
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <ProfileCard
        name={user.name}
        email={user.email}
        avatarSrc={avatarSrc(user.avatar)}
        onEditClick={() => setEditingProfile(true)}
        isPremium
        isVerified
        editLabel={tu('edit')}
        premiumLabel={tu('premium')}
        verifiedLabel={tu('verified')}
        avatarLabel={(name) => tu('avatar', { name })}
      />

      <SettingsSection
        title={t('banks')}
        icon={Landmark}
        iconColor="var(--brand)"
      >
        <Link
          href="/settings/banks"
          className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <SettingRow
            label={t('connectedBanks')}
            description={t('connectedBanksDescription')}
            icon={Landmark}
          >
            <ChevronRight
              aria-hidden
              className="size-4 text-on-surface-variant"
            />
          </SettingRow>
        </Link>
      </SettingsSection>

      <SettingsSection
        title={t('movements')}
        icon={Tags}
        iconColor="var(--highlight)"
      >
        <Link
          href="/settings/categories"
          className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <SettingRow
            label={t('categories')}
            description={t('categoriesDescription')}
            icon={Shapes}
          >
            <ChevronRight
              aria-hidden
              className="size-4 text-on-surface-variant"
            />
          </SettingRow>
        </Link>
        <Link
          href="/settings/aliases"
          className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <SettingRow
            label={t('aliases')}
            description={t('aliasesDescription')}
            icon={Text}
          >
            <ChevronRight
              aria-hidden
              className="size-4 text-on-surface-variant"
            />
          </SettingRow>
        </Link>
        <Link
          href="/transactions/categorize"
          className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <SettingRow
            label={t('categorize')}
            description={t('categorizeDescription')}
            icon={Tags}
          >
            <ChevronRight
              aria-hidden
              className="size-4 text-on-surface-variant"
            />
          </SettingRow>
        </Link>
      </SettingsSection>

      {user.role === 'admin' ? (
        <SettingsSection
          title={t('admin')}
          icon={UserCog}
          iconColor="var(--accent-neon)"
        >
          <Link
            href="/admin"
            className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <SettingRow
              label={t('admin')}
              description={t('adminDescription')}
              icon={UserCog}
            >
              <ChevronRight
                aria-hidden
                className="size-4 text-on-surface-variant"
              />
            </SettingRow>
          </Link>
        </SettingsSection>
      ) : null}

      <SettingsSection
        title={t('security')}
        icon={ShieldCheck}
        iconColor="var(--tertiary)"
      >
        <SettingRow
          label={t('biometrics')}
          icon={Fingerprint}
          controlId="biometrics"
        >
          <Switch
            id="biometrics"
            checked={toggles.biometrics}
            onCheckedChange={(v) =>
              setToggles((s) => ({ ...s, biometrics: v }))
            }
          />
        </SettingRow>
        <PrivacySettings />
      </SettingsSection>

      <SettingsSection
        title={t('appearance')}
        icon={Paintbrush}
        iconColor="var(--highlight)"
      >
        <LanguageSelect />
        <ThemeSelect />
        <SettingRow label={t('colorMode')} icon={Moon} controlId="color-mode">
          <ModeSegmented id="color-mode" />
        </SettingRow>
        <SettingRow label={t('font')} icon={Type}>
          <span className="text-[13px] font-medium text-highlight">Ubuntu</span>
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title={t('notifications')}
        icon={BellRing}
        iconColor="#6c72cb"
      >
        <SettingRow
          label={t('transactions')}
          description={t('transactionsDescription')}
          controlId="tx-notif"
        >
          <Switch
            id="tx-notif"
            checked={toggles.transactions}
            onCheckedChange={(v) =>
              setToggles((s) => ({ ...s, transactions: v }))
            }
          />
        </SettingRow>
        <SettingRow
          label={t('weeklySummary')}
          description={t('weeklySummaryDescription')}
          controlId="weekly"
        >
          <Switch
            id="weekly"
            checked={toggles.weeklySummary}
            onCheckedChange={(v) =>
              setToggles((s) => ({ ...s, weeklySummary: v }))
            }
          />
        </SettingRow>
      </SettingsSection>

      <form action={signOut} className="mt-4 flex flex-col">
        <Button
          type="submit"
          variant="destructive"
          size="lg"
          className="rounded-[20px] text-base font-bold"
        >
          <LogOut className="size-5" /> {t('signOut')}
        </Button>
      </form>

      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
        {t('version')}
      </p>
      {editingProfile ? (
        <ProfileDialog onClose={() => setEditingProfile(false)} />
      ) : null}
    </div>
  );
}
