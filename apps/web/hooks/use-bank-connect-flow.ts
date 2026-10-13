'use client';

import * as React from 'react';
import { BankConnectFlow, type FlowStep } from '@finnit/bank-connect';

import { bankConnectApi } from '@/lib/bank-connect/api';

/**
 * One BankConnectFlow per mounted screen. Leaving the screen cancels any
 * login in progress, so nothing keeps talking to the bank in the background.
 */
export function useBankConnectFlow(): {
  flow: BankConnectFlow;
  step: FlowStep;
} {
  const [flow] = React.useState(() => new BankConnectFlow(bankConnectApi));
  const step = React.useSyncExternalStore(
    (onChange) => flow.subscribe(onChange),
    () => flow.step,
    () => flow.step,
  );
  React.useEffect(() => () => flow.cancel(), [flow]);
  return { flow, step };
}
