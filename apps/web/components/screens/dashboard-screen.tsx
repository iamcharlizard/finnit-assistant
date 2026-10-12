'use client';

import Link from 'next/link';

import { BalanceCard } from '@finnit/ui/components/finance/balance-card';
import { QuickAction } from '@finnit/ui/components/finance/quick-action';
import { SparklineChart } from '@finnit/ui/components/finance/sparkline-chart';
import { StatCard } from '@finnit/ui/components/finance/stat-card';
import { TransactionItemExpense } from '@finnit/ui/components/finance/transaction-item-expense';
import { TransactionItemIncome } from '@finnit/ui/components/finance/transaction-item-income';
import { Card } from '@finnit/ui/components/ui/card';
import { SectionHeading } from '@finnit/ui/components/ui/section-heading';
import { Separator } from '@finnit/ui/components/ui/separator';

import {
  MOCK_FINANCIAL_DATA,
  QUICK_CATEGORIES,
  RECENT_TRANSACTIONS,
} from '@/lib/mocks/dashboard';

export function DashboardScreen() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <BalanceCard.Root>
          <BalanceCard.Header
            amount={MOCK_FINANCIAL_DATA.balance}
            trend={MOCK_FINANCIAL_DATA.trend}
            trendPositive={MOCK_FINANCIAL_DATA.trendPositive}
          />
          <BalanceCard.Chart>
            <SparklineChart />
          </BalanceCard.Chart>
        </BalanceCard.Root>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            variant="income"
            label="Ingresos Mensuales"
            amount={MOCK_FINANCIAL_DATA.monthlyIncome}
          />
          <StatCard
            variant="expense"
            label="Gastos Mensuales"
            amount={MOCK_FINANCIAL_DATA.monthlyExpenses}
          />
        </div>
      </div>

      <section className="lg:row-span-2">
        <SectionHeading title="Categorías Rápidas" />
        <Card className="grid grid-cols-3 gap-y-4 p-4">
          {QUICK_CATEGORIES.map((cat) => (
            <QuickAction
              key={cat.label}
              label={cat.label}
              icon={cat.icon}
              accessibilityLabel={`Filtrar por ${cat.label}`}
              className="justify-self-center"
            />
          ))}
        </Card>
      </section>

      <section className="lg:col-span-2">
        <SectionHeading
          title="Actividad Reciente"
          action={
            <Link
              href="/history"
              aria-label="Ver todas las transacciones"
              className="flex min-h-11 items-center text-sm font-medium text-income hover:underline"
            >
              Ver todo
            </Link>
          }
        />
        <Card className="gap-0 overflow-hidden p-0">
          {RECENT_TRANSACTIONS.map((tx, i) => {
            const Item =
              tx.type === 'income'
                ? TransactionItemIncome
                : TransactionItemExpense;
            return (
              <div key={tx.id}>
                <Item
                  merchant={tx.merchant}
                  category={tx.category}
                  time={tx.time}
                  amount={tx.amount}
                  icon={tx.icon}
                  className="rounded-none bg-transparent"
                />
                {i < RECENT_TRANSACTIONS.length - 1 ? (
                  <Separator className="mx-4 w-auto opacity-40 data-[orientation=horizontal]:w-auto" />
                ) : null}
              </div>
            );
          })}
        </Card>
      </section>
    </div>
  );
}
