import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

const ARROW =
  'flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** "‹ Octubre 2026 ›" with links to the previous and next month. */
export function MonthSwitcher({
  label,
  prevHref,
  nextHref,
  as: Heading = 'h1',
  compact = false,
}: {
  label: string;
  prevHref: string;
  nextHref: string | null;
  /** The label's element: h1 when the month is the page's title. */
  as?: 'h1' | 'h2' | 'p';
  /** Smaller text, for toolbars. */
  compact?: boolean;
}) {
  const t = useTranslations('monthSwitcher');
  return (
    <nav aria-label={t('label')} className="flex items-center gap-1">
      <Link href={prevHref} aria-label={t('previous')} className={ARROW}>
        <ChevronLeft aria-hidden className="size-5" />
      </Link>
      <Heading
        className={cn(
          'text-center font-bold text-on-background',
          compact ? 'min-w-32 text-base' : 'min-w-40 text-xl',
        )}
      >
        {label}
      </Heading>
      {nextHref ? (
        <Link href={nextHref} aria-label={t('next')} className={ARROW}>
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      ) : (
        <span aria-hidden className={`${ARROW} opacity-30`}>
          <ChevronRight className="size-5" />
        </span>
      )}
    </nav>
  );
}
