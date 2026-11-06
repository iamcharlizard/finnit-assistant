import * as React from 'react';
import {
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { CloudOff } from 'lucide-react-native';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { BOTTOM_NAV_SPACE } from '@finnit/ui-native/components/navigation/bottom-nav-bar';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { LogoSpinner } from '@finnit/ui-native/components/ui/logo-spinner';
import { Text } from '@finnit/ui-native/components/ui/text';

import { PageHeader } from './page-header';

/** How far to pull for the mark to finish its first 120° turn. */
const PULL_FULL = 80;
/** The room the pull opens above the content (iOS holds about this much while refreshing). */
const PULL_AREA = 64;

interface ScreenProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: boolean;
  /** Pull to refresh. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** First load: a spinner instead of the content. */
  loading?: boolean;
  /** Load failed: a retry message instead of the content. */
  error?: unknown;
  /** Screens with the bottom bar leave room for it (true for tabs). */
  withBottomNav?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * A screen's frame (the web's page inside AppShell): safe areas, the
 * floating header (fixed: only the content under it scrolls), pull to
 * refresh and room for the bottom bar. Content
 * stacks with gap-5, like the web's screens.
 */
export function Screen({
  title,
  subtitle,
  actions,
  back,
  refreshing = false,
  onRefresh,
  loading,
  error,
  withBottomNav = true,
  className,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const t = useTranslations();
  // How far the content is pulled down (0 → 1 at PULL_FULL), for the mark.
  const pull = useSharedValue(0);
  // Only a pull shows the loader: refreshes after an edit stay quiet.
  const [pulled, setPulled] = React.useState(false);
  const pulling = refreshing && pulled;

  // When the refresh ends, forget the pull (state adjusted during render).
  const [wasRefreshing, setWasRefreshing] = React.useState(refreshing);
  if (refreshing !== wasRefreshing) {
    setWasRefreshing(refreshing);
    if (!refreshing) setPulled(false);
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    pull.value = Math.max(0, -event.nativeEvent.contentOffset.y) / PULL_FULL;
  };

  return (
    <TwView className="flex-1">
      {/* The bar stays put; everything under it scrolls (and pulls to refresh). */}
      <TwView className="px-4 pb-2" style={{ paddingTop: insets.top + 8 }}>
        <PageHeader title={title} back={back} />
      </TwView>
      <View style={{ flex: 1 }}>
        <TwScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          onScroll={onRefresh ? onScroll : undefined}
          scrollEventThrottle={16}
          contentContainerClassName={cn('gap-5 px-4', className)}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom:
              insets.bottom + (withBottomNav ? BOTTOM_NAV_SPACE : 24),
          }}
          refreshControl={
            onRefresh ? (
              // The native gesture, with its spinner hidden: the Finnit mark shows instead.
              <RefreshControl
                refreshing={pulling}
                onRefresh={() => {
                  setPulled(true);
                  onRefresh();
                }}
                tintColor="transparent"
                colors={['transparent']}
                progressBackgroundColor="transparent"
              />
            ) : undefined
          }
        >
          {subtitle || actions ? (
            <TwView className="gap-3">
              {typeof subtitle === 'string' ? (
                <Text className="px-1 text-sm text-on-surface-variant">
                  {subtitle}
                </Text>
              ) : (
                subtitle
              )}
              {actions ? (
                <TwView className="flex-row flex-wrap items-center gap-3">
                  {actions}
                </TwView>
              ) : null}
            </TwView>
          ) : null}
          {loading ? (
            <TwView className="items-center py-16">
              <LogoSpinner size={40} accessibilityLabel={t('common.loading')} />
            </TwView>
          ) : error ? (
            <EmptyState
              icon={CloudOff}
              title={t('errors.loadFailedTitle')}
              description={t('errors.loadFailedDescription')}
              action={
                onRefresh
                  ? { label: t('common.retry'), onPress: onRefresh }
                  : undefined
              }
            />
          ) : (
            children
          )}
        </TwScrollView>
        {onRefresh ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: PULL_AREA,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogoSpinner size={32} spinning={pulling} progress={pull} />
          </View>
        ) : null}
      </View>
    </TwView>
  );
}
