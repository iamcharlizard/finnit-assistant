import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { cn } from '@finnit/ui/lib/utils';

/** Honest "nothing here yet" block, with an optional next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-card border border-dashed border-on-background/12 px-6 py-10 text-center',
        className,
      )}
    >
      <Icon aria-hidden className="size-10 text-on-surface-variant/50" />
      <p className="text-base font-medium text-on-background">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-on-surface-variant">
          {description}
        </p>
      ) : null}
      {action ? (
        <Button variant="secondary" size="sm" asChild className="mt-2">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
