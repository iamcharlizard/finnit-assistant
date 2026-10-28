import { X } from 'lucide-react';

/** A scenario item (monthly or one-time) with a remove button. */
export function ItemRow({
  title,
  detail,
  amount,
  muted = false,
  removeLabel,
  onRemove,
}: {
  title: string;
  detail: string;
  amount: string;
  /** Left out of the simulation (e.g. beyond the projected months). */
  muted?: boolean;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <li
      className={
        muted
          ? 'flex items-center gap-2 rounded-input bg-track/60 py-1.5 pr-1 pl-3 opacity-60'
          : 'flex items-center gap-2 rounded-input bg-track/60 py-1.5 pr-1 pl-3'
      }
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-on-background">
          {title}
        </span>
        <span className="truncate text-xs text-on-surface-variant">
          {detail}
        </span>
      </div>
      <span className="shrink-0 text-sm font-bold text-on-background tabular-nums">
        {amount}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}
