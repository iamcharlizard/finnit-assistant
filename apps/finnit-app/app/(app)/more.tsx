import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { Settings } from 'lucide-react-native';

import { SETTINGS_HREF } from '@finnit/core/nav/sections';
import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

import { NAV_ITEM_ICONS } from '@/lib/nav/icons';
import { useNav } from '@/lib/nav/use-nav';

/** "Más": every section that isn't in the bottom bar, then Settings. */
export default function MoreSheet() {
  const t = useTranslations('nav');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rest, activeHref } = useNav();

  const go = (href: string) => {
    router.back();
    router.navigate(href as Href);
  };

  return (
    <TwView className="bg-popover px-4 pt-6" style={{ paddingBottom: Math.max(24, insets.bottom) }}>
      <Text weight="bold" className="text-lg text-on-background">
        {t('moreTitle')}
      </Text>
      <Text className="mb-3 text-sm text-on-surface-variant">{t('moreDescription')}</Text>
      {rest.map(({ entry, section }) => {
        const active = entry.href === activeHref;
        const label = section.items.length === 1 ? t(`sections.${section.key}`) : t(`items.${entry.key}`);
        return (
          <TwPressable
            key={entry.href}
            accessibilityRole="link"
            accessibilityState={{ selected: active }}
            onPress={() => go(entry.href)}
            className={cn(
              'min-h-12 flex-row items-center gap-3 rounded-chip px-3 active:scale-[0.98]',
              active && 'bg-primary-15',
            )}
          >
            <Icon icon={NAV_ITEM_ICONS[entry.key]} color={active ? '--brand-ink' : '--on-surface-variant'} />
            <Text weight="medium" className={cn('text-base', active ? 'text-on-background' : 'text-on-surface-variant')}>
              {label}
            </Text>
          </TwPressable>
        );
      })}
      <TwView className="mt-1 border-t border-outline-60 pt-2">
        <TwPressable
          accessibilityRole="link"
          onPress={() => go(SETTINGS_HREF)}
          className="min-h-12 flex-row items-center gap-3 rounded-chip px-3 active:scale-[0.98]"
        >
          <Icon icon={Settings} color="--on-surface-variant" />
          <Text weight="medium" className="text-base text-on-surface-variant">
            {t('settings')}
          </Text>
        </TwPressable>
      </TwView>
    </TwView>
  );
}
