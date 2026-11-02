import * as React from 'react';

import { cn } from '@finnit/ui/lib/utils';

/** A small card above a hovered or focused mark: a title and labeled values. */
export function ChartTooltip({
  title,
  rows,
  className,
  style,
}: {
  title: string;
  rows: { key: string; label: string; value: string; color?: string }[];
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="tooltip"
      style={style}
      className={cn(
        'pointer-events-none absolute bottom-full z-10 mb-2 min-w-36 rounded-input border border-outline bg-surface px-3 py-2 text-xs shadow-md',
        className,
      )}
    >
      <p className="mb-1 font-medium text-on-background">{title}</p>
      <dl className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            {row.color ? (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: row.color }}
              />
            ) : null}
            <dt className="flex-1 text-on-surface-variant">{row.label}</dt>
            <dd className="font-medium text-on-background tabular-nums">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
