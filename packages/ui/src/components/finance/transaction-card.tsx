'use client';

import * as React from 'react';
import { Loader2, Lock, Pencil, type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Checkbox } from '../ui/checkbox';

type CardVariant = 'income' | 'expense' | 'pending' | 'failed';
type CardStatusVariant = 'completado' | 'info' | 'pendiente' | 'fallida';

interface TransactionCardRename {
  /** Saves the new name; rejecting keeps the field open. */
  onSave: (name: string) => Promise<void>;
  /** The text the field starts with (defaults to the shown name). */
  value?: string;
  /** Accessible name of the pencil button. */
  editLabel: string;
  /** Accessible name of the field. */
  inputLabel: string;
  maxLength?: number;
}

interface TransactionCardProps {
  merchant: string;
  category: string;
  time: string;
  amount: string;
  icon: LucideIcon;
  variant: CardVariant;
  /** Small text under the amount (e.g. "Completado"). */
  status?: { label: string; variant: CardStatusVariant };
  /** Opens the movement (the whole card is the target). */
  onOpen?: () => void;
  /** Accessible name of the card's open action. */
  openLabel?: string;
  isPrivate?: boolean;
  privateLabel?: string;
  /** A leading checkbox (bulk actions); it doesn't open the card. */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
  selectLabel?: string;
  /** A pencil next to the name (on hover) edits it right in the card. */
  rename?: TransactionCardRename;
  /** Inside the card, under the row (e.g. a category suggestion). */
  footer?: React.ReactNode;
  className?: string;
}

const ICON_BG: Record<CardVariant, string> = {
  income: 'bg-income/10 dark:bg-income/20',
  pending: 'bg-track',
  expense: 'bg-expense/8 dark:bg-expense/15',
  failed: 'bg-expense/8 dark:bg-expense/15',
};

const AMOUNT_COLOR: Record<CardVariant, string> = {
  income: 'text-income',
  pending: 'text-on-surface-variant',
  expense: 'text-expense',
  failed: 'text-expense',
};

const STATUS_COLOR: Record<CardStatusVariant, string> = {
  completado: 'text-income',
  info: 'text-on-surface-variant',
  pendiente: 'text-on-surface-variant',
  fallida: 'text-expense',
};

/**
 * A movement as a card: icon, name, category and time, amount (and status).
 * The whole card opens the movement (a stretched button under the content),
 * while the checkbox, the name's pencil and the footer (e.g. a suggestion's
 * ✓ ✕) sit above it and do their own thing, so no control is nested in
 * another. The pencil shows on hover (always on touch screens and on focus)
 * and turns the name into a field: Enter or leaving saves, Escape cancels.
 */
function TransactionCard({
  merchant,
  category,
  time,
  amount,
  icon: Icon,
  variant,
  status,
  onOpen,
  openLabel,
  isPrivate,
  privateLabel = 'Private',
  selectable,
  selected = false,
  onSelectedChange,
  selectLabel,
  rename,
  footer,
  className,
}: TransactionCardProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pencilRef = React.useRef<HTMLButtonElement>(null);
  // Escape cancels; the blur that follows must not save.
  const cancelled = React.useRef(false);

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEditing() {
    if (!rename) return;
    cancelled.current = false;
    setDraft(rename.value ?? merchant);
    setFailed(false);
    setEditing(true);
  }

  async function commit() {
    if (!rename || saving || cancelled.current) return;
    const next = draft.trim();
    if (next === (rename.value ?? merchant).trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await rename.onSave(next);
      setEditing(false);
      requestAnimationFrame(() => pencilRef.current?.focus());
    } catch {
      setFailed(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-slot="transaction-card"
      data-selected={selected || undefined}
      className={cn(
        'group/card relative flex flex-col rounded-2xl bg-surface transition-[background-color,box-shadow] has-[[data-card-open]:hover]:bg-accent data-[selected]:ring-2 data-[selected]:ring-ring/60',
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          data-card-open
          onClick={onOpen}
          aria-label={openLabel ?? merchant}
          className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      ) : null}

      <div className="pointer-events-none relative flex min-h-11 items-center gap-3 p-4">
        {selectable ? (
          // The label widens the checkbox hit area to 44px.
          <label className="pointer-events-auto -my-2 -ml-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) =>
                onSelectedChange?.(checked === true)
              }
              aria-label={selectLabel ?? `Select ${merchant}`}
            />
          </label>
        ) : null}
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-chip',
            ICON_BG[variant],
          )}
        >
          <Icon aria-hidden className="size-[22px] text-on-surface-variant" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          {editing && rename ? (
            <span className="pointer-events-auto flex items-center gap-2">
              <input
                ref={inputRef}
                value={draft}
                maxLength={rename.maxLength}
                aria-label={rename.inputLabel}
                aria-invalid={failed || undefined}
                disabled={saving}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setFailed(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void commit();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelled.current = true;
                    setEditing(false);
                    requestAnimationFrame(() => pencilRef.current?.focus());
                  }
                }}
                onBlur={() => void commit()}
                className={cn(
                  'min-w-0 flex-1 rounded-lg border bg-background px-2 py-1 text-sm font-medium text-on-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  failed ? 'border-expense' : 'border-outline',
                )}
              />
              {saving ? (
                <Loader2
                  aria-hidden
                  className="size-4 shrink-0 animate-spin text-on-surface-variant"
                />
              ) : null}
            </span>
          ) : (
            <span className="group/name flex min-w-0 items-center gap-1 text-sm font-medium text-on-background">
              {isPrivate ? (
                <Lock
                  role="img"
                  aria-label={privateLabel}
                  className="size-3.5 shrink-0 text-on-surface-variant"
                />
              ) : null}
              <span className="truncate">{merchant}</span>
              {rename ? (
                <button
                  ref={pencilRef}
                  type="button"
                  onClick={startEditing}
                  aria-label={rename.editLabel}
                  title={rename.editLabel}
                  className="pointer-events-auto flex size-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant opacity-0 outline-none transition-opacity hover:bg-track hover:text-on-background focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 group-hover/name:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <Pencil aria-hidden className="size-3.5" />
                </button>
              ) : null}
            </span>
          )}
          <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
            {category} · {time}
          </span>
        </span>
        <span className="ml-2 flex shrink-0 flex-col items-end">
          <span className={cn('text-sm font-bold', AMOUNT_COLOR[variant])}>
            {amount}
          </span>
          {status ? (
            <span
              className={cn('mt-0.5 text-[11px]', STATUS_COLOR[status.variant])}
            >
              {status.label}
            </span>
          ) : null}
        </span>
      </div>

      {footer ? (
        <div
          className={cn(
            'pointer-events-none relative -mt-2 px-4 pb-3 [&>*]:pointer-events-auto',
            // Lines up with the name (checkbox + icon before it).
            selectable ? 'pl-[7.25rem]' : 'pl-20',
          )}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export {
  TransactionCard,
  type TransactionCardProps,
  type TransactionCardRename,
  type CardVariant,
  type CardStatusVariant,
};
