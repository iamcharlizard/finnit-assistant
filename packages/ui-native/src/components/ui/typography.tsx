import { cn } from '../../lib/utils';
import { Text, type TextProps } from './text';

/*
 * Finnit type scale, the same five variants as @finnit/ui's typography.
 * Headings set accessibilityRole="header" (the web's h1–h3).
 */

function DisplayLg({ className, ...props }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      weight="bold"
      className={cn('text-display-lg text-on-background', className)}
      {...props}
    />
  );
}

function HeadlineLg({ className, ...props }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      weight="bold"
      className={cn('text-headline-lg text-on-background', className)}
      {...props}
    />
  );
}

function TitleLg({ className, ...props }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      weight="medium"
      className={cn('text-title-lg text-on-background', className)}
      {...props}
    />
  );
}

function BodyMd({ className, ...props }: TextProps) {
  return <Text className={cn('text-body-md text-on-background', className)} {...props} />;
}

function LabelSm({ className, ...props }: TextProps) {
  return (
    <Text
      weight="medium"
      className={cn(
        'text-label-sm uppercase tracking-widest text-on-surface-variant',
        className,
      )}
      {...props}
    />
  );
}

export { DisplayLg, HeadlineLg, TitleLg, BodyMd, LabelSm };
