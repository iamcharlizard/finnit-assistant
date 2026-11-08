import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { CalendarDays, ChartLine, Landmark, Plus } from 'lucide-react-native';

import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Card } from '@finnit/ui-native/components/ui/card';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

const STEPS = [
  { icon: Landmark, key: 'stepBank' },
  { icon: ChartLine, key: 'stepCategories' },
  { icon: CalendarDays, key: 'stepRecurring' },
] as const;

/** First visit: no accounts and no movements yet. */
export function DashboardWelcome() {
  const t = useTranslations();
  const router = useRouter();
  return (
    <Card className="items-start gap-5 p-6">
      <TwView>
        <Text accessibilityRole="header" weight="bold" className="mb-2 text-[28px]" style={{ lineHeight: 36 }}>
          {t('dashboard.welcome.title')}
        </Text>
        <Text className="text-[15px] text-on-surface-variant">{t('dashboard.welcome.description')}</Text>
      </TwView>
      <TwView className="gap-3">
        {STEPS.map(({ icon, key }) => (
          <TwView key={key} className="flex-row items-start gap-3">
            <Icon icon={icon} size={20} color="--brand-ink" />
            <Text className="flex-1 text-sm">{t(`dashboard.welcome.${key}`)}</Text>
          </TwView>
        ))}
      </TwView>
      <Button label={t('common.connectBank')} icon={Plus} onPress={() => router.push('/connect-bank')} />
    </Card>
  );
}
