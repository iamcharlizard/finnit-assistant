import * as React from 'react';

import { cn } from '../../lib/utils';

type TypographyProps<T extends React.ElementType> = {
  as?: T;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as'>;

/*
 * Finnit type scale. Like the shadcn primitives, this file groups the
 * scale's five variants instead of splitting one per file.
 */

function DisplayLg<T extends React.ElementType = 'h1'>({
  as,
  className,
  ...props
}: TypographyProps<T>) {
  const Comp = as ?? 'h1';
  return (
    <Comp
      className={cn('text-display-lg font-bold text-on-background', className)}
      {...props}
    />
  );
}

function HeadlineLg<T extends React.ElementType = 'h2'>({
  as,
  className,
  ...props
}: TypographyProps<T>) {
  const Comp = as ?? 'h2';
  return (
    <Comp
      className={cn('text-headline-lg font-bold text-on-background', className)}
      {...props}
    />
  );
}

function TitleLg<T extends React.ElementType = 'h3'>({
  as,
  className,
  ...props
}: TypographyProps<T>) {
  const Comp = as ?? 'h3';
  return (
    <Comp
      className={cn('text-title-lg font-medium text-on-background', className)}
      {...props}
    />
  );
}

function BodyMd<T extends React.ElementType = 'p'>({
  as,
  className,
  ...props
}: TypographyProps<T>) {
  const Comp = as ?? 'p';
  return (
    <Comp
      className={cn('text-body-md text-on-background', className)}
      {...props}
    />
  );
}

function LabelSm<T extends React.ElementType = 'span'>({
  as,
  className,
  ...props
}: TypographyProps<T>) {
  const Comp = as ?? 'span';
  return (
    <Comp
      className={cn(
        'text-label-sm font-medium uppercase tracking-widest text-on-surface-variant',
        className,
      )}
      {...props}
    />
  );
}

export { DisplayLg, HeadlineLg, TitleLg, BodyMd, LabelSm };
