import { useIsFocused, useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { ArrowLeft, CircleHelp } from 'lucide-react-native';

import { TwPressable } from '@finnit/ui-native/lib/tw';
import { Avatar } from '@finnit/ui-native/components/ui/avatar';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { InfoHint } from '@finnit/ui-native/components/ui/info-hint';
import { TopAppBar } from '@finnit/ui-native/components/navigation/top-app-bar';
import { TourTarget } from '@finnit/ui-native/components/tour/tour-target';

import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/lib/notifications/use-unread-count';
import { avatarSource } from '@/lib/profile/avatar';

/**
 * A screen's heading in the floating top bar, like the web's PageHeader:
 * title, the notifications bell and the avatar (profile menu). `Screen`
 * renders the subtitle and actions itself, in the scrolling content. With `back`, a button before the title goes back.
 * `help` (what the screen is for) opens from a question mark next to the title.
 */
export function PageHeader({
  title,
  back,
  help,
}: {
  title: string;
  back?: boolean;
  help?: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const { user } = useAuth();
  const unread = useUnreadCount();
  // Every screen has an avatar: only the one shown is the tour's "profile" stop.
  const focused = useIsFocused();
  return (
    <TopAppBar
      title={title}
      leading={
        back ? (
          <TwPressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
            className="-ml-2 size-11 items-center justify-center rounded-full active:bg-accent"
          >
            <Icon icon={ArrowLeft} size={22} color="--on-background" />
          </TwPressable>
        ) : null
      }
      titleAccessory={
        help ? (
          <InfoHint label={title} text={help} icon={CircleHelp} iconSize={20} closeLabel={t('common.close')} />
        ) : null
      }
      notificationCount={unread}
      onNotificationsPress={() => router.push('/notifications')}
      notificationsLabel={(count) =>
        count > 0 ? t('ui.notificationsUnread', { count }) : t('ui.notifications')
      }
      profile={
        user ? (
          <TourTarget id="profile" enabled={focused}>
            <TwPressable
              accessibilityRole="button"
              accessibilityLabel={t('profileMenu.open')}
              onPress={() => router.push('/profile')}
              className="size-11 items-center justify-center rounded-full"
            >
              <Avatar name={user.name} source={avatarSource(user.avatar)} size={36} className="border-2 border-primary" />
            </TwPressable>
          </TourTarget>
        ) : null
      }
    />
  );
}
