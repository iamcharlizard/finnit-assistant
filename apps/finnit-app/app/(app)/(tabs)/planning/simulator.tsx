import { useTranslations } from 'use-intl';

import { ScreenPlaceholder } from '@/components/shell/screen-placeholder';

export default function Screen() {
  const t = useTranslations('nav.items');
  return <ScreenPlaceholder title={t('simulator')} />;
}
