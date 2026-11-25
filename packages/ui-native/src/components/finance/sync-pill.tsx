import type { AccountSync } from '@finnit/core/accounts/sync';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { Text } from '../ui/text';

const TONE: Record<AccountSync['kind'], { box: string; text: string }> = {
  manual: { box: 'bg-track', text: 'text-on-surface-variant' },
  auto: { box: 'bg-income-10', text: 'text-income' },
  failed: { box: 'bg-expense-10', text: 'text-expense' },
};

/** How an account updates: "Manual", "Automática · hace 2 h" or "No se actualizó". */
function SyncPill({
  sync,
  className,
}: {
  sync: AccountSync;
  className?: string;
}) {
  const tone = TONE[sync.kind];
  return (
    <TwView
      className={cn('self-start rounded-full px-2 py-0.5', tone.box, className)}
    >
      <Text
        weight="medium"
        numberOfLines={1}
        className={cn('text-[11px]', tone.text)}
      >
        {sync.label}
      </Text>
    </TwView>
  );
}

export { SyncPill };
