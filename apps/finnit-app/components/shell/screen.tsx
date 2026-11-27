import * as React from 'react';
import { RefreshControl, View, type HostInstance } from 'react-native';
import {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { CloudOff } from 'lucide-react-native';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwAnimatedScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { BOTTOM_NAV_SPACE } from '@finnit/ui-native/components/navigation/bottom-nav-bar';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';
import { LogoSpinner } from '@finnit/ui-native/components/ui/logo-spinner';
import { Text } from '@finnit/ui-native/components/ui/text';

import { PageHeader } from './page-header';
import { StickyContext, type StickyScroll } from './sticky';

/** How far to pull for the mark to finish its first 120° turn. */
const PULL_FULL = 80;
/** The room the pull opens above the content (iOS holds about this much while refreshing). */
const PULL_AREA = 64;
/** Room above the content. */
const CONTENT_TOP = 8;
/** How close to the end the lists start loading their next page. */
const END_DISTANCE = 600;

type EndListener = () => void;
const ScrollEndContext = React.createContext<
  ((listener: EndListener) => () => void) | null
>(null);

/**
 * Infinite scroll inside a Screen: `onEnd` runs when the content's end comes
 * near (the lists load their next page). A list outside a Screen never
 * hears it.
 */
export function useOnScrollEnd(onEnd: () => void) {
  const subscribe = React.useContext(ScrollEndContext);
  const latest = React.useRef(onEnd);
  React.useEffect(() => {
    latest.current = onEnd;
  }, [onEnd]);
  React.useEffect(() => subscribe?.(() => latest.current()), [subscribe]);
}

interface ScreenProps {
  title: string;
  /** Under the header, scrolling: data about what is shown (a date, a period). */
  subtitle?: React.ReactNode;
  /** What the screen is for: a question mark next to the title opens it. */
  help?: string;
  /**
   * A toolbar fixed under the header (e.g. the history's month and
   * filters): the content scrolls below it, never behind it, so only the
   * screen's background shows around it. `StickyGroup` headings stick
   * right under it.
   */
  sticky?: React.ReactNode;
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
  help,
  sticky,
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

  const listeners = React.useRef(new Set<EndListener>());
  const subscribe = React.useCallback((listener: EndListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const notifyEnd = React.useCallback(() => {
    listeners.current.forEach((listener) => listener());
  }, []);

  // Read on the UI thread, so stuck headings move with the scroll.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const { contentOffset, contentSize, layoutMeasurement } = event;
      scrollY.value = contentOffset.y;
      pull.value = Math.max(0, -contentOffset.y) / PULL_FULL;
      if (
        contentOffset.y + layoutMeasurement.height >=
        contentSize.height - END_DISTANCE
      ) {
        scheduleOnRN(notifyEnd);
      }
    },
  });

  const viewport = React.useRef<HostInstance>(null);
  const measurers = React.useRef(new Set<() => void>());
  const stickyScroll = React.useMemo<StickyScroll>(
    () => ({
      scrollY,
      viewport,
      onBodyLayout: (measure) => {
        measurers.current.add(measure);
        return () => {
          measurers.current.delete(measure);
        };
      },
    }),
    [scrollY],
  );

  return (
    <TwView className="flex-1">
      {/* The bar stays put; everything under it scrolls (and pulls to refresh). */}
      <TwView className="px-4 pb-2" style={{ paddingTop: insets.top + 8 }}>
        <PageHeader title={title} back={back} help={help} />
      </TwView>
      {sticky ? <TwView className="px-4 pb-2">{sticky}</TwView> : null}
      <View ref={viewport} style={{ flex: 1 }}>
        <TwAnimatedScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerClassName={cn('gap-5 px-4', className)}
          contentContainerStyle={{
            paddingTop: CONTENT_TOP,
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
            <ScrollEndContext.Provider value={subscribe}>
              <StickyContext.Provider value={stickyScroll}>
                {/* When anything in here changes size, stuck headings
                    measure again. */}
                <View
                  onLayout={() => {
                    measurers.current.forEach((measure) => measure());
                  }}
                  style={{ gap: 20 }}
                >
                  {children}
                </View>
              </StickyContext.Provider>
            </ScrollEndContext.Provider>
          )}
        </TwAnimatedScrollView>
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
