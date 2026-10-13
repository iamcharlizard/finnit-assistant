import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ARROW =
  'flex size-11 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** "‹ Octubre 2026 ›" with links to the previous and next month. */
export function MonthSwitcher({
  label,
  prevHref,
  nextHref,
}: {
  label: string;
  prevHref: string;
  nextHref: string | null;
}) {
  const t = useTranslations('monthSwitcher');
  return (
    <nav aria-label={t('label')} className="flex items-center gap-1">
      <Link href={prevHref} aria-label={t('previous')} className={ARROW}>
        <ChevronLeft aria-hidden className="size-5" />
      </Link>
      <h1 className="min-w-40 text-center text-xl font-bold text-on-background">
        {label}
      </h1>
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
