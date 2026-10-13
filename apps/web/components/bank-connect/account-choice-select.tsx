import type { AccountChoice } from '@finnit/bank-connect';

import type { FinnitAccount } from '@/lib/bank-connect/api';

const encode = (choice: AccountChoice) =>
  typeof choice === 'string' ? choice : `account:${choice.accountId}`;
const decode = (value: string): AccountChoice =>
  value.startsWith('account:')
    ? { accountId: value.slice(8) }
    : (value as AccountChoice);

/** Where a bank account imports into: a new Finnit account, an existing one or nowhere. */
export function AccountChoiceSelect({
  id,
  value,
  accounts,
  onChange,
}: {
  id: string;
  value: AccountChoice;
  accounts: FinnitAccount[];
  onChange: (choice: AccountChoice) => void;
}) {
  return (
    <select
      id={id}
      value={encode(value)}
      onChange={(e) => onChange(decode(e.target.value))}
      className="min-h-11 w-full rounded-input border border-outline bg-transparent px-3 text-sm text-on-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:w-64"
    >
      <option value="create">Crear cuenta en Finnit</option>
      {accounts.length ? (
        <optgroup label="Ligar a una cuenta existente">
          {accounts.map((account) => (
            <option key={account.id} value={`account:${account.id}`}>
              {account.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      <option value="skip">No importar</option>
    </select>
  );
}
