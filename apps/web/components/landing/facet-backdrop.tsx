import { cn } from '@finnit/ui/lib/utils';

/**
 * Loose triangles from the logo's grid drifting behind a section. Purely
 * decorative; sits under the content (`-z-10`) and never takes clicks.
 */
const SHARDS = [
  {
    className: 'right-[4%] top-[12%] size-28',
    fill: 'var(--facet-1)',
    r: -12,
    o: 0.22,
  },
  {
    className: 'left-[6%] top-[6%] size-40',
    fill: 'var(--facet-2)',
    r: 18,
    o: 0.16,
  },
  {
    className: 'left-[42%] bottom-[4%] size-20',
    fill: 'var(--facet-3)',
    r: 200,
    o: 0.18,
  },
  {
    className: 'left-[30%] bottom-[14%] size-14',
    fill: 'var(--ai)',
    r: 40,
    o: 0.2,
  },
  {
    className: 'right-[3%] bottom-[30%] size-10',
    fill: 'var(--facet-2)',
    r: 160,
    o: 0.25,
  },
] as const;

export function FacetBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className,
      )}
    >
      {SHARDS.map((shard, i) => (
        <svg
          key={i}
          viewBox="0 0 100 87"
          className={cn('landing-float absolute', shard.className)}
          style={
            {
              '--r': `${shard.r}deg`,
              animationDelay: `${i * -1.7}s`,
              opacity: shard.o,
            } as React.CSSProperties
          }
        >
          <path d="M50 0L100 87H0Z" fill={shard.fill} />
        </svg>
      ))}
    </div>
  );
}
