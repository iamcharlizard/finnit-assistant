'use client';

import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  CircleArrowDown,
  CircleArrowUp,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';

import type { EntryKind } from '@finnit/core/new-entry/form';

type PickedKind = EntryKind | 'cardPayment';

const KINDS: ReadonlyArray<{
  kind: PickedKind;
  icon: LucideIcon;
  tone: string;
}> = [
  { kind: 'expense', icon: CircleArrowUp, tone: 'text-expense' },
  { kind: 'income', icon: CircleArrowDown, tone: 'text-income' },
  { kind: 'transfer', icon: ArrowLeftRight, tone: 'text-violet-ink' },
  { kind: 'cardPayment', icon: CreditCard, tone: 'text-violet-ink' },
];

/**
 * Step 1: gasto, ingreso, transferencia or, with a credit card registered,
 * pago a tarjeta (a transfer into a card).
 */
export function EntryKindPicker({
  onPick,
  withCardPayment,
}: {
  onPick: (kind: PickedKind) => void;
  withCardPayment: boolean;
}) {
  const t = useTranslations('newEntry');
  const kinds = KINDS.filter(
    ({ kind }) => kind !== 'cardPayment' || withCardPayment,
  );
  return (
    <ul
      className={
        kinds.length === 4
          ? 'grid grid-cols-2 gap-2 sm:grid-cols-4'
          : 'grid gap-2 sm:grid-cols-3'
      }
    >
      {kinds.map(({ kind, icon: Icon, tone }) => (
        <li key={kind}>
          <button
            type="button"
            onClick={() => onPick(kind)}
            className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-xl bg-track p-3 text-center outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Icon aria-hidden className={`size-6 ${tone}`} />
            <span className="text-sm font-medium text-on-background">
              {t(kind)}
            </span>
            <span className="text-[11px] text-on-surface-variant">
              {t(`kindHints.${kind}`)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
