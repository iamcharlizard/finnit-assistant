'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { BankConnectFlow, type FlowStep } from '@finnit/bank-connect';

import { bankConnectApi } from '@/lib/bank-connect/api';

/**
 * One BankConnectFlow per mounted screen, speaking the user's language.
 * Leaving the screen cancels any login in progress, so nothing keeps
 * talking to the bank in the background.
 */
export function useBankConnectFlow(): {
  flow: BankConnectFlow;
  step: FlowStep;
} {
  const locale = useLocale();
  const [flow] = React.useState(
    () => new BankConnectFlow(bankConnectApi, { locale }),
  );
  React.useEffect(() => flow.setLocale(locale), [flow, locale]);
  const step = React.useSyncExternalStore(
    (onChange) => flow.subscribe(onChange),
    () => flow.step,
    () => flow.step,
  );
  React.useEffect(() => () => flow.cancel(), [flow]);
  return { flow, step };
}
