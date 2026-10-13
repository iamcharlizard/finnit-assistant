import { useState } from 'react';
import { useQuery } from 'urql';
import type { AccountChoice, ConnectedAccount, ConnectedBank } from '@finnit/bank-connect';

import { TwView } from '@/lib/tw';
import { FINNIT_ACCOUNTS_QUERY, type FinnitAccountsResult } from '@/lib/graphql/queries/bank-connect';
import { AccountChoiceRow, type AccountChoiceMode } from './account-choice-row';
import { AlertBox } from './alert-box';
import { FlowButton } from './flow-button';
import { StepLayout } from './step-layout';

interface LinkAccountsStepProps {
  bank: ConnectedBank;
  message?: string;
  onSubmit: (choices: Record<string, AccountChoice>) => void;
}

function defaultMode(account: ConnectedAccount): AccountChoiceMode {
  if (account.type === 'Credit Card' || account.type === 'Checking') return 'create';
  if (account.type === 'Savings' && !account.balance) return 'skip';
  return 'create';
}

/** Choose what each bank account imports into, then import its movements. */
export function LinkAccountsStep({ bank, message, onSubmit }: LinkAccountsStepProps) {
  const [{ data, fetching, error: accountsError }] = useQuery<FinnitAccountsResult>({
    query: FINNIT_ACCOUNTS_QUERY,
    requestPolicy: 'network-only',
  });
  const finnitAccounts = data?.accounts.edges.map((edge) => edge.node) ?? [];

  const pending = bank.accounts.filter((a) => !a.accountId);
  const [modes, setModes] = useState<Record<string, AccountChoiceMode>>(() =>
    Object.fromEntries(pending.map((a) => [a.id, defaultMode(a)])),
  );
  const [existing, setExisting] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);

  function submit() {
    const choices: Record<string, AccountChoice> = {};
    const unpicked: string[] = [];
    for (const account of pending) {
      const mode = modes[account.id] ?? 'skip';
      if (mode === 'existing') {
        const accountId = existing[account.id];
        if (accountId) choices[account.id] = { accountId };
        else unpicked.push(account.id);
      } else {
        choices[account.id] = mode;
      }
    }
    setMissing(unpicked);
    if (unpicked.length === 0) onSubmit(choices);
  }

  return (
    <StepLayout
      title={`Cuentas de ${bank.institution ?? 'tu banco'}`}
      description="Elige qué cuentas quieres importar a Finnit. Las que no importes puedes ligarlas después."
      symbolName="list.bullet.rectangle.fill"
      footer={<FlowButton label="Importar movimientos" onPress={submit} />}
    >
      {message ? <AlertBox message={message} /> : null}
      {accountsError ? (
        <AlertBox tone="warning" message="No pudimos cargar tus cuentas de Finnit; por ahora solo puedes crear cuentas nuevas." />
      ) : null}
      {missing.length > 0 ? <AlertBox message="Elige la cuenta de Finnit para las cuentas marcadas." /> : null}

      <TwView className="gap-3">
        {bank.accounts.map((account) => (
          <AccountChoiceRow
            key={account.id}
            account={account}
            mode={modes[account.id] ?? 'skip'}
            existingId={existing[account.id]}
            finnitAccounts={finnitAccounts}
            loadingAccounts={fetching}
            onChangeMode={(mode) => setModes((prev) => ({ ...prev, [account.id]: mode }))}
            onChangeExisting={(accountId) => setExisting((prev) => ({ ...prev, [account.id]: accountId }))}
            error={missing.includes(account.id) ? 'Elige una cuenta de Finnit' : undefined}
          />
        ))}
      </TwView>
    </StepLayout>
  );
}
