'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';
import { Checkbox } from '../ui/checkbox';

/** Selection props shared by the transaction rows. */
interface TransactionSelectionProps {
  /** Shows a checkbox before the row (bulk actions). */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
  /** Accessible name of the checkbox. Defaults to "Select <merchant>". */
  selectLabel?: string;
}

interface TransactionItemSelectionProps extends TransactionSelectionProps {
  merchant: string;
  className?: string;
  /** The row button; rendered as-is when the row is not selectable. */
  children: React.ReactElement<{ className?: string }>;
}

/**
 * Wraps a transaction row with a leading checkbox. The checkbox is a sibling
 * of the row button (interactive elements can't nest), keyboard reachable with
 * Tab and toggled with Space.
 */
function TransactionItemSelection({
  selectable,
  selected = false,
  onSelectedChange,
  selectLabel,
  merchant,
  className,
  children,
}: TransactionItemSelectionProps) {
  if (!selectable) return children;

  return (
    <div
      data-slot="transaction-item-selection"
      data-selected={selected || undefined}
      className={cn(
        'flex w-full items-center rounded-2xl bg-surface transition-shadow data-[selected]:ring-2 data-[selected]:ring-ring/60',
        className,
      )}
    >
      {/* The label widens the checkbox hit area to 44px. */}
      <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center pl-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange?.(checked === true)}
          aria-label={selectLabel ?? `Select ${merchant}`}
        />
      </label>
      {React.cloneElement(children, {
        className: cn(
          children.props.className,
          'min-w-0 flex-1 bg-transparent pl-2',
        ),
      })}
    </div>
  );
}

export {
  TransactionItemSelection,
  type TransactionItemSelectionProps,
  type TransactionSelectionProps,
};
