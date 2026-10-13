'use client';

import { cn } from '../../lib/utils';
import {
  DEFAULT_ACCENT,
  STATUS_STYLE,
  type RecurringCalendarEvent,
} from './recurring-calendar-types';

interface RecurringCalendarEventChipProps {
  event: RecurringCalendarEvent;
  compact?: boolean;
  statusLabel?: string;
  onClick?: (event: RecurringCalendarEvent) => void;
}

/** One event as a chip; a button when `onClick` is given. */
function RecurringCalendarEventChip({
  event,
  compact = false,
  statusLabel,
  onClick,
}: RecurringCalendarEventChipProps) {
  const style = STATUS_STYLE[event.status];
  const Icon = style.icon;
  const content = (
    <>
      {Icon ? <Icon aria-hidden className="size-3 shrink-0" /> : null}
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      {!compact && event.amountLabel ? (
        <span className="shrink-0 font-medium">{event.amountLabel}</span>
      ) : null}
      {statusLabel ? <span className="sr-only">, {statusLabel}</span> : null}
    </>
  );
  const className = cn(
    'flex w-full min-w-0 items-center gap-1 rounded-md border-l-[3px] bg-muted text-left',
    compact ? 'px-1 py-0.5 text-[11px]' : 'min-h-8 px-2 py-1 text-xs',
    style.text,
  );
  const accent = { borderLeftColor: event.color ?? DEFAULT_ACCENT };

  if (!onClick) {
    return (
      <span className={className} style={accent}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={cn(
        className,
        'outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
      )}
      style={accent}
    >
      {content}
    </button>
  );
}

export { RecurringCalendarEventChip, type RecurringCalendarEventChipProps };
