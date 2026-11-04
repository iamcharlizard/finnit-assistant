import Image from 'next/image';

import { cn } from '@finnit/ui/lib/utils';

/*
 * Finnit's brand images (public/brand/). Each comes in a light variant (for
 * light surfaces) and a dark one; both are rendered and the `.dark` class
 * picks one, so the server output matches either mode. SVGs, served as is.
 */
const ASSETS = {
  mark: { width: 128, height: 112 },
  wordmark: { width: 2494, height: 792 },
  logo: { width: 353.6, height: 112 },
} as const;

type Asset = keyof typeof ASSETS;

function BrandImage({
  asset,
  alt,
  className,
  priority,
}: {
  asset: Asset;
  alt: string;
  /** Size it with a height (e.g. `h-6 w-auto`); the width follows. */
  className?: string;
  priority?: boolean;
}) {
  const { width, height } = ASSETS[asset];
  const common = { width, height, unoptimized: true, priority } as const;
  return (
    <>
      <Image
        {...common}
        src={`/brand/finnit-${asset}-light.svg`}
        alt={alt}
        className={cn('dark:hidden', className)}
      />
      <Image
        {...common}
        src={`/brand/finnit-${asset}-dark.svg`}
        alt={alt}
        className={cn('hidden dark:block', className)}
      />
    </>
  );
}

/** The symbol alone. Decorative unless given an `alt`. */
export function BrandMark({
  className,
  alt = '',
  priority,
}: {
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <BrandImage
      asset="mark"
      alt={alt}
      className={className}
      priority={priority}
    />
  );
}

/** "Finnit" as the brand's lettering. */
export function BrandWordmark({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <BrandImage
      asset="wordmark"
      alt="Finnit"
      className={className}
      priority={priority}
    />
  );
}

/** Symbol and lettering together. */
export function BrandLogo({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <BrandImage
      asset="logo"
      alt="Finnit"
      className={className}
      priority={priority}
    />
  );
}
