import { useTranslations } from 'use-intl';

import { TwView } from '@finnit/ui-native/lib/tw';
import { Text } from '@finnit/ui-native/components/ui/text';
import { HeadlineLg } from '@finnit/ui-native/components/ui/typography';

/** A screen not built on mobile yet: its title and "Próximamente". */
export function ScreenPlaceholder({ title }: { title: string }) {
  const t = useTranslations('common');
  return (
    <TwView className="flex-1 items-center justify-center gap-2 px-6">
      <HeadlineLg className="text-center">{title}</HeadlineLg>
      <Text className="text-center text-on-surface-variant">{t('comingSoon')}</Text>
    </TwView>
  );
}
