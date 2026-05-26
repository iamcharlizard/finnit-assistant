import { TwView, TwText, TwPressable } from '../../lib/tw';
import { TwImage } from '../../lib/tw/image';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import type { ImageSource } from 'expo-image';

interface TopAppBarProps {
  title: string;
  avatarSource?: ImageSource;
  notificationCount?: number;
  onNotificationsPress?: () => void;
  onAvatarPress?: () => void;
}

export function TopAppBar({
  title,
  avatarSource,
  notificationCount = 0,
  onNotificationsPress,
  onAvatarPress,
}: TopAppBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  return (
    <TwView
      className={`flex-row justify-between items-center px-4 border-b ${
        isDark ? 'border-outline-dark' : 'border-outline'
      }`}
      style={{
        // NW-FALLBACK: rgba glassmorphism
        backgroundColor: isDark
          ? 'rgba(18, 19, 26, 0.88)'
          : 'rgba(255, 255, 255, 0.88)',
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        boxShadow: isDark
          ? '0 2px 16px rgba(0,0,0,0.3)'
          : '0 2px 16px rgba(0,0,0,0.05)',
      }}
    >
      <TwText
        className={`text-[22px] font-bold ${isDark ? 'text-primary-dark' : 'text-primary'}`}
        style={{ fontFamily: 'Ubuntu Bold' }}
      >
        {title}
      </TwText>

      <TwView className="flex-row items-center gap-3">
        <TwPressable
          onPress={onNotificationsPress}
          accessibilityRole="button"
          accessibilityLabel={
            notificationCount > 0
              ? `Notificaciones, ${notificationCount} nuevas`
              : 'Notificaciones'
          }
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <TwView>
            <SymbolView
              name="bell.fill"
              size={22}
              tintColor={isDark ? '#a0a0a0' : '#5c6370'}
              accessibilityLabel=""
            />
            {notificationCount > 0 ? (
              <TwView
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-expense items-center justify-center"
              >
                <TwText className="text-white text-[9px]" style={{ fontFamily: 'Ubuntu Bold' }}>
                  {notificationCount > 9 ? '9+' : String(notificationCount)}
                </TwText>
              </TwView>
            ) : null}
          </TwView>
        </TwPressable>

        {avatarSource ? (
          <TwPressable
            onPress={onAvatarPress}
            accessibilityRole="button"
            accessibilityLabel="Perfil de usuario"
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <TwImage
              source={avatarSource}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 2,
                borderColor: isDark ? '#6c72cb' : '#00f5ff',
              }}
              contentFit="cover"
              accessibilityLabel="Avatar del usuario"
            />
          </TwPressable>
        ) : null}
      </TwView>
    </TwView>
  );
}
