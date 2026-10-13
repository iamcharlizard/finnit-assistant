'use client';

import Link from 'next/link';
import { CalendarCheck, Inbox, Landmark } from 'lucide-react';

import { StatCard } from '@finnit/ui/components/finance/stat-card';
import { Card } from '@finnit/ui/components/ui/card';
import { SectionHeading } from '@finnit/ui/components/ui/section-heading';
import { Separator } from '@finnit/ui/components/ui/separator';

import { BalanceSummary } from '@/components/dashboard/balance-summary';
import { DashboardWelcome } from '@/components/dashboard/dashboard-welcome';
import { EmptyState } from '@/components/finance/empty-state';
import { PaymentRow } from '@/components/finance/payment-row';
import { TransactionRow } from '@/components/finance/transaction-row';
import { useSessionUser } from '@/components/session-provider';
import { UPCOMING_DAYS, type DashboardView } from '@/lib/dashboard/view';

const LINK_CLASS =
  'flex min-h-11 items-center text-sm font-medium text-income hover:underline';

export function DashboardScreen({ view }: { view: DashboardView }) {
  const user = useSessionUser();
  const firstName = user.name.split(' ')[0] ?? user.name;

  if (view.isEmpty) return <DashboardWelcome firstName={firstName} />;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        {view.balance ? (
          <BalanceSummary balance={view.balance} />
        ) : (
          <EmptyState
            icon={Landmark}
            title="Aún no tienes cuentas"
            description="Conecta tu banco para ver tus saldos aquí."
            action={{
              href: '/settings/banks/connect',
              label: 'Conectar banco',
            }}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            variant="income"
            label={`Ingresos · ${view.month.label}`}
            amount={view.month.income}
          />
          <StatCard
            variant="expense"
            label={`Gastos · ${view.month.label}`}
            amount={view.month.expenses}
          />
        </div>
      </div>

      <section className="min-w-0 lg:row-span-2">
        <SectionHeading
          title="Próximos pagos"
          action={
            <Link href="/calendar" className={LINK_CLASS}>
              Calendario
            </Link>
          }
        />
        {view.upcoming.length > 0 ? (
          <div className="flex flex-col gap-2">
            {view.upcoming.map((row) => (
              <PaymentRow key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="Sin pagos próximos"
            description={`No tienes pagos recurrentes en los próximos ${UPCOMING_DAYS} días.`}
          />
        )}
      </section>

      <section className="min-w-0 lg:col-span-2">
        <SectionHeading
          title="Actividad reciente"
          action={
            view.recent.length > 0 ? (
              <Link
                href="/history"
                aria-label="Ver todas las transacciones"
                className={LINK_CLASS}
              >
                Ver todo
              </Link>
            ) : null
          }
        />
        {view.recent.length > 0 ? (
          <Card className="gap-0 overflow-hidden p-0">
            {view.recent.map((row, i) => (
              <div key={row.id}>
                <TransactionRow
                  row={row}
                  className="rounded-none bg-transparent"
                />
                {i < view.recent.length - 1 ? (
                  <Separator className="mx-4 w-auto opacity-40 data-[orientation=horizontal]:w-auto" />
                ) : null}
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon={Inbox}
            title="Sin movimientos todavía"
            description="Cuando tu banco importe movimientos aparecerán aquí."
          />
        )}
      </section>
    </div>
  );
}
