import { cn } from '@finnit/ui/lib/utils';

/*
 * The logo's symbol as inline paths, colored with the --facet-* tokens so
 * it follows the palette and light/dark (public/brand/ has the fixed-color
 * files). Same geometry as finnit-mark-*.svg.
 */
const FACETS = [
  'M38.6 97.2L72 39.3L60.9 20L49.7 39.3L54 46.8L31.7 85.4ZM98.6 124L109.7 104.7L76.3 46.8L69.4 58.6L89.1 92.8L94.3 92.8L101.1 104.7L94.3 116.5ZM23.1 124L34.3 104.7L23.1 85.4L12 104.7Z',
  'M52.3 97.2L72 63.1L69.4 58.6L76.3 46.8L90 46.8L94.3 39.3L72 39.3L38.6 97.2ZM45.4 124L49.7 116.5L94.3 116.5L101.1 104.7L34.3 104.7L23.1 124ZM120.9 124L132 104.7L109.7 104.7L98.6 124Z',
  'M72 39.3L94.3 39.3L83.1 20L60.9 20ZM109.7 104.7L132 104.7L120.9 85.4L112.3 85.4L90 46.8L76.3 46.8ZM34.3 104.7L101.1 104.7L94.3 92.8L54.9 92.8L52.3 97.2L38.6 97.2L31.7 85.4L23.1 85.4Z',
] as const;

const FILLS = ['var(--facet-1)', 'var(--facet-2)', 'var(--facet-3)'] as const;

/** Decorative (aria-hidden) unless given a `title`. */
export function FacetMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="8 16 128 112"
      className={cn('h-auto', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {FACETS.map((d, i) => (
        <path key={d} d={d} fill={FILLS[i]} />
      ))}
    </svg>
  );
}
