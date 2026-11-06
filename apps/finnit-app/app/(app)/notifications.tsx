import { useTranslations } from 'use-intl';

import { ScreenPlaceholder } from '@/components/shell/screen-placeholder';

export default function Notifications() {
  const t = useTranslations('notifications');
  return <ScreenPlaceholder title={t('title')} />;
}
