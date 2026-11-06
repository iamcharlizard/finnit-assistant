import { cn } from '@finnit/ui/lib/utils';

/** Eyebrow + title (+ lead) used by every landing section. */
export function LandingSectionHeading({
  id,
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      <p
        className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-ai-ink uppercase data-[align=center]:justify-center"
        data-align={align}
      >
        <svg aria-hidden viewBox="0 0 100 87" className="size-3">
          <path d="M50 0L100 87H0Z" fill="currentColor" />
        </svg>
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-4 text-[32px] leading-[1.1] font-bold tracking-[-0.025em] text-on-background @2xl:text-[44px]"
      >
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
          {lead}
        </p>
      ) : null}
    </div>
  );
}
