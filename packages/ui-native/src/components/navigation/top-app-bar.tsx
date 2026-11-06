import type * as React from 'react';
import { Bell } from 'lucide-react-native';

import { TwPressable, TwView } from '../../lib/tw';
import { GlassSurface } from '../ui/glass-surface';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';

interface TopAppBarProps {
  title: string;
  /** Under the bar (on phones the web puts it there too). */
  subtitle?: React.ReactNode;
  /** Page actions, under the bar. */
  actions?: React.ReactNode;
  /** Before the title, e.g. a back button. */
  leading?: React.ReactNode;
  /** Icon buttons before the bell. */
  tools?: React.ReactNode;
  notificationCount?: number;
  onNotificationsPress?: () => void;
  notificationsLabel?: (count: number) => string;
  /** The avatar button (opens the profile menu). */
  profile?: React.ReactNode;
}

const defaultNotificationsLabel = (count: number) =>
  count > 0 ? `Notifications, ${count} new` : 'Notifications';

/**
 * @finnit/ui's TopAppBar: a floating glass pill with the screen's title,
 * the notifications bell (with its count) and the profile avatar.
 */
function TopAppBar({
  title,
  subtitle,
  actions,
  leading,
  tools,
  notificationCount = 0,
  onNotificationsPress,
  notificationsLabel = defaultNotificationsLabel,
  profile,
}: TopAppBarProps) {
  return (
    <TwView className="gap-3">
      <GlassSurface className="-mx-1 min-h-16 flex-row items-center justify-between gap-3 rounded-full py-2.5 pl-5 pr-2.5">
        <TwView className="min-w-0 flex-1 flex-row items-center gap-2">
          {leading}
          <Text
            accessibilityRole="header"
            weight="bold"
            numberOfLines={1}
            className="min-w-0 flex-1 text-title-lg text-brand-ink"
          >
            {title}
          </Text>
        </TwView>
        <TwView className="shrink-0 flex-row items-center gap-1">
          {tools}
          {onNotificationsPress ? (
            <TwPressable
              accessibilityRole="button"
              accessibilityLabel={notificationsLabel(notificationCount)}
              onPress={onNotificationsPress}
              className="size-11 items-center justify-center rounded-full active:bg-accent"
            >
              <Icon icon={Bell} size={22} color="--on-surface-variant" />
              {notificationCount > 0 ? (
                <TwView className="absolute right-1.5 top-1.5 size-4 items-center justify-center rounded-full bg-[#ba1a1a]">
                  <Text weight="bold" className="text-[9px] text-white">
                    {notificationCount > 9 ? '9+' : String(notificationCount)}
                  </Text>
                </TwView>
              ) : null}
            </TwPressable>
          ) : null}
          {profile}
        </TwView>
      </GlassSurface>
      {subtitle ? (
        typeof subtitle === 'string' ? (
          <Text className="px-1 text-sm text-on-surface-variant">{subtitle}</Text>
        ) : (
          subtitle
        )
      ) : null}
      {actions ? <TwView className="flex-row flex-wrap items-center gap-3">{actions}</TwView> : null}
    </TwView>
  );
}

export { TopAppBar, type TopAppBarProps };
