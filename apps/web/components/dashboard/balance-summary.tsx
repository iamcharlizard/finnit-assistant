import { BalanceCard } from '@finnit/ui/components/finance/balance-card';

import type { DashboardView } from '@/lib/dashboard/view';

/** Money available, card debt and the net of all accounts. */
export function BalanceSummary({
  balance,
}: {
  balance: NonNullable<DashboardView['balance']>;
}) {
  return (
    <BalanceCard.Root>
      <BalanceCard.Header label="Saldo disponible" amount={balance.available} />
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {balance.creditDebt ? (
          <div>
            <dt className="text-xs text-on-surface-variant">
              Deuda en tarjetas
            </dt>
            <dd className="font-bold text-expense">{balance.creditDebt}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-on-surface-variant">Patrimonio neto</dt>
          <dd className="font-bold text-on-background">{balance.net}</dd>
        </div>
      </dl>
      <BalanceCard.Footer className="flex-wrap gap-2 text-xs text-on-surface-variant">
        <span>
          {balance.accountCount === 1
            ? '1 cuenta'
            : `${balance.accountCount} cuentas`}
        </span>
        {balance.otherCurrencies.length > 0 ? (
          <span>También: {balance.otherCurrencies.join(' · ')}</span>
        ) : null}
      </BalanceCard.Footer>
    </BalanceCard.Root>
  );
}
