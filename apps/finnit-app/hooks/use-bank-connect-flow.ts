import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { BankConnectFlow, type FlowStep } from '@finnit/bank-connect';

import { createBankConnectApi } from '@/lib/bank-connect/api';

/**
 * One BankConnectFlow per screen mount. Re-renders on every step change and
 * cancels any ongoing bank login when the screen unmounts.
 */
export function useBankConnectFlow(): { flow: BankConnectFlow; step: FlowStep } {
  // Lazy initializer: created once per mount (equivalent to a lazily set ref).
  const [flow] = useState(() => new BankConnectFlow(createBankConnectApi()));

  const subscribe = useCallback(
    (onChange: () => void) => {
      const unsubscribe = flow.subscribe(onChange);
      return () => {
        unsubscribe();
      };
    },
    [flow],
  );
  const getStep = useCallback(() => flow.step, [flow]);
  const step = useSyncExternalStore(subscribe, getStep, getStep);

  useEffect(() => () => flow.cancel(), [flow]);

  return { flow, step };
}
