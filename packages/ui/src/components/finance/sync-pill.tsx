import type { AccountSync } from '@finnit/core/accounts/sync';

import { cn } from '../../lib/utils';

const TONE: Record<AccountSync['kind'], string> = {
  manual: 'bg-track text-on-surface-variant',
  auto: 'bg-income/10 text-income',
  failed: 'bg-expense/10 text-expense',
};

/** How an account updates: "Manual", "Automática · hace 2 h" or "No se actualizó". */
function SyncPill({
  sync,
  className,
}: {
  sync: AccountSync;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'w-fit rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        TONE[sync.kind],
        className,
      )}
    >
      {sync.label}
    </span>
  );
}

export { SyncPill };
