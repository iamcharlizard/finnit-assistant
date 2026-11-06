import * as React from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { Check, LogOut, Monitor, Moon, Palette, Settings, Sun, type LucideIcon } from 'lucide-react-native';

import { APP_THEMES } from '@finnit/core/theme/app-theme';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Avatar } from '@finnit/ui-native/components/ui/avatar';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Separator } from '@finnit/ui-native/components/ui/separator';
import { Text } from '@finnit/ui-native/components/ui/text';

import { useAuth } from '@/contexts/AuthContext';
import { avatarSource } from '@/lib/profile/avatar';
import { APP_THEME } from '@/lib/theme/app-theme';
import { useAppearance, type AppearancePreference } from '@/lib/theme/appearance';

const MODES: { value: AppearancePreference; icon: LucideIcon }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
];

function Row({
  icon,
  label,
  hint,
  selected,
  onPress,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  selected?: boolean;
  onPress: () => void;
  tone?: 'danger';
}) {
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 rounded-chip px-3 active:bg-accent"
    >
      <Icon icon={icon} color={tone === 'danger' ? '--expense' : '--on-surface-variant'} />
      <TwView className="min-w-0 flex-1">
        <Text weight="medium" className={cn('text-base', tone === 'danger' ? 'text-expense' : 'text-on-background')}>
          {label}
        </Text>
        {hint ? <Text className="text-xs text-on-surface-variant">{hint}</Text> : null}
      </TwView>
      {selected ? <Icon icon={Check} size={18} color="--brand-ink" /> : null}
    </TwPressable>
  );
}

/**
 * The profile menu (the web's avatar dropdown): light / dark / system,
 * the palette preview for admins, Settings and sign out.
 */
export default function ProfileSheet() {
  const t = useTranslations('profileMenu');
  const tm = useTranslations('ui.mode');
  const tt = useTranslations('ui.theme');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { appearance, setAppearance, theme, setPreviewTheme } = useAppearance();
  const [signingOut, setSigningOut] = React.useState(false);
  if (!user) return null;

  return (
    <TwView className="bg-popover px-3 pt-6" style={{ paddingBottom: Math.max(24, insets.bottom) }}>
      <TwView className="mb-3 flex-row items-center gap-3 px-3">
        <Avatar name={user.name} source={avatarSource(user.avatar)} size={44} />
        <TwView className="min-w-0 flex-1">
          <Text weight="bold" numberOfLines={1} className="text-base">
            {user.name}
          </Text>
          <Text numberOfLines={1} className="text-sm text-on-surface-variant">
            {user.email}
          </Text>
        </TwView>
      </TwView>
      <Separator className="mb-2" />

      <Text weight="medium" className="px-3 pb-1 text-label-sm uppercase tracking-widest text-on-surface-variant">
        {tm('label')}
      </Text>
      {MODES.map(({ value, icon }) => (
        <Row
          key={value}
          icon={icon}
          label={value === 'system' ? t('systemMode') : tm(value)}
          selected={appearance === value}
          onPress={() => setAppearance(value)}
        />
      ))}

      {user.role === 'admin' ? (
        <>
          <Separator className="my-2" />
          <Text weight="medium" className="px-3 pb-1 text-label-sm uppercase tracking-widest text-on-surface-variant">
            {tt('previewLabel')}
          </Text>
          {APP_THEMES.map((option) => (
            <Row
              key={option}
              icon={Palette}
              label={`${tt(`names.${option}`)}${option === APP_THEME ? ` · ${tt('siteBadge')}` : ''}`}
              hint={tt(`descriptions.${option}`)}
              selected={theme === option}
              onPress={() => setPreviewTheme(option)}
            />
          ))}
        </>
      ) : null}

      <Separator className="my-2" />
      <Row
        icon={Settings}
        label={t('settings')}
        onPress={() => {
          router.back();
          router.navigate('/settings');
        }}
      />
      <Row
        icon={LogOut}
        tone="danger"
        label={signingOut ? t('signingOut') : t('signOut')}
        onPress={async () => {
          if (signingOut) return;
          setSigningOut(true);
          router.dismissAll();
          await logout();
        }}
      />
    </TwView>
  );
}
