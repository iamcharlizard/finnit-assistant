import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslations } from 'use-intl';
import { CalendarCheck } from 'lucide-react-native';

import { UPCOMING_DAYS, type DashboardView } from '@finnit/core/dashboard/view';
import { TwView } from '@finnit/ui-native/lib/tw';
import { CollapsibleHeading } from '@finnit/ui-native/components/ui/collapsible-heading';
import { EmptyState } from '@finnit/ui-native/components/ui/empty-state';

import { PaymentRow } from '@/components/finance/payment-row';
import { TextLink } from '@/components/finance/text-link';
import { useCollapsedSection } from '@/lib/dashboard/collapsed-sections';

/** "Próximos pagos": what is due in the next days; the title folds it. */
export function DashboardUpcoming({
  rows,
}: {
  rows: DashboardView['upcoming'];
}) {
  const t = useTranslations('dashboard');
  const [collapsed, toggle] = useCollapsedSection('upcoming');
  return (
    <TwView>
      <CollapsibleHeading
        title={t('upcoming')}
        collapsed={collapsed}
        onToggle={toggle}
        action={<TextLink href="/recurring" label={t('calendarLink')} />}
      />
      {collapsed ? null : (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
        >
          {rows.length > 0 ? (
            <TwView className="gap-2">
              {rows.map((row) => (
                <PaymentRow key={row.id} row={row} />
              ))}
            </TwView>
          ) : (
            <EmptyState
              icon={CalendarCheck}
              title={t('noUpcomingTitle')}
              description={t('noUpcomingDescription', {
                days: String(UPCOMING_DAYS),
              })}
            />
          )}
        </Animated.View>
      )}
    </TwView>
  );
}
