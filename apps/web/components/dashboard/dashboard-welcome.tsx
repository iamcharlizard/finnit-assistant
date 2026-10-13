import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarDays, ChartLine, Landmark, Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Card } from '@finnit/ui/components/ui/card';

const STEPS = [
  { icon: Landmark, key: 'stepBank' },
  { icon: ChartLine, key: 'stepCategories' },
  { icon: CalendarDays, key: 'stepRecurring' },
] as const;

/** First visit: no accounts and no movements yet. */
export function DashboardWelcome({ firstName }: { firstName: string }) {
  const t = useTranslations();
  return (
    <Card className="mx-auto max-w-2xl items-start gap-5 p-6 sm:p-8">
      <div>
        <h1 className="mb-2 text-[28px] leading-9 font-bold text-on-background">
          {t('dashboard.welcome.title', { name: firstName })}
        </h1>
        <p className="text-[15px] text-on-surface-variant">
          {t('dashboard.welcome.description')}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {STEPS.map(({ icon: Icon, key }) => (
          <li key={key} className="flex items-start gap-3 text-sm">
            <Icon
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-brand-ink"
            />
            <span className="text-on-background">
              {t(`dashboard.welcome.${key}`)}
            </span>
          </li>
        ))}
      </ul>
      <Button asChild>
        <Link href="/settings/banks/connect">
          <Plus className="size-4" /> {t('common.connectBank')}
        </Link>
      </Button>
    </Card>
  );
}
