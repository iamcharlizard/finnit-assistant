'use client';

import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  CircleArrowDown,
  CircleArrowUp,
  type LucideIcon,
} from 'lucide-react';

import type { EntryKind } from '@/lib/new-entry/form';

const KINDS: ReadonlyArray<{
  kind: EntryKind;
  icon: LucideIcon;
  tone: string;
}> = [
  { kind: 'expense', icon: CircleArrowUp, tone: 'text-expense' },
  { kind: 'income', icon: CircleArrowDown, tone: 'text-income' },
  { kind: 'transfer', icon: ArrowLeftRight, tone: 'text-violet-ink' },
];

/** Step 1: gasto, ingreso or transferencia (which includes card payments). */
export function EntryKindPicker({
  onPick,
}: {
  onPick: (kind: EntryKind) => void;
}) {
  const t = useTranslations('newEntry');
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {KINDS.map(({ kind, icon: Icon, tone }) => (
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
