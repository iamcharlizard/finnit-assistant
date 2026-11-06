import type * as React from 'react';
import { ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { CloudOff } from 'lucide-react-native';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { useToken } from '@finnit/ui-native/theme/theme-root';
import { BOTTOM_NAV_SPACE } from '@finnit/ui-native/components/navigation/bottom-nav-bar';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';

import { PageHeader } from './page-header';

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
 * floating header, pull to refresh and room for the bottom bar. Content
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
  const tint = useToken('--on-surface-variant');
  return (
    <TwScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerClassName={cn('gap-5 px-4', className)}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + (withBottomNav ? BOTTOM_NAV_SPACE : 24),
      }}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} /> : undefined
      }
    >
      <PageHeader title={title} subtitle={subtitle} actions={actions} back={back} />
      {loading ? (
        <TwView className="items-center py-16">
          <ActivityIndicator color={tint} />
        </TwView>
      ) : error ? (
        <EmptyState
          icon={CloudOff}
          title={t('errors.loadFailedTitle')}
          description={t('errors.loadFailedDescription')}
          action={onRefresh ? { label: t('common.retry'), onPress: onRefresh } : undefined}
        />
      ) : (
        children
      )}
    </TwScrollView>
  );
}
