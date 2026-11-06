import * as React from 'react';

import { InfoHint } from '@finnit/ui/components/ui/info-hint';
import { cn } from '@finnit/ui/lib/utils';

/** The frame of a summary chart: title, optional help and an aside. */
export function ChartCard({
  title,
  hint,
  hintLabel,
  aside,
  className,
  children,
}: {
  title: string;
  hint?: string;
  hintLabel?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-card border border-outline bg-surface p-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-on-background">
          {title}
          {hint ? <InfoHint label={hintLabel ?? title}>{hint}</InfoHint> : null}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
