import { useTranslations } from 'use-intl';

import { ScreenPlaceholder } from '@/components/shell/screen-placeholder';

export default function NewEntry() {
  const t = useTranslations('nav');
  return <ScreenPlaceholder title={t('newTransaction')} />;
}
