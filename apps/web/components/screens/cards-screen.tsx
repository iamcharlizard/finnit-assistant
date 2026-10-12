'use client';

import * as React from 'react';
import { Globe, Lock, Nfc, Utensils, type LucideIcon } from 'lucide-react';

import { BankPaymentCard } from '@finnit/ui/components/finance/bank-payment-card';
import { CreditLimitCard } from '@finnit/ui/components/finance/credit-limit-card';
import { ExpenseProjectionCard } from '@finnit/ui/components/finance/expense-projection-card';
import { MonthlySpendingCard } from '@finnit/ui/components/finance/monthly-spending-card';
import { TransactionItemExpense } from '@finnit/ui/components/finance/transaction-item-expense';
import { SettingRow } from '@finnit/ui/components/settings/setting-row';
import { SettingsSection } from '@finnit/ui/components/settings/settings-section';
import { SectionHeading } from '@finnit/ui/components/ui/section-heading';
import { Switch } from '@finnit/ui/components/ui/switch';

import { CARDS, CREDIT_LIMIT } from '@/lib/mocks/cards';

type SecurityFeature = 'bloquear' | 'contactless' | 'internacional';

const SECURITY_ROWS: ReadonlyArray<{
  key: SecurityFeature;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'bloquear', label: 'Bloquear Tarjeta', icon: Lock },
  { key: 'contactless', label: 'Pago Sin Contacto', icon: Nfc },
  { key: 'internacional', label: 'Compras Int.', icon: Globe },
];

export function CardsScreen() {
  const [security, setSecurity] = React.useState<
    Record<SecurityFeature, boolean>
  >({
    bloquear: false,
    contactless: true,
    internacional: false,
  });

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3.5 flex items-end justify-between px-1">
          <h1 className="text-[22px] font-bold text-on-background">
            Mis Tarjetas
          </h1>
          <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-on-surface-variant">
            {CARDS.length} activas
          </span>
        </div>
        <div
          aria-label="Carrusel de tarjetas"
          className="-mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 [scrollbar-width:none]"
        >
          {CARDS.map((card) => (
            <BankPaymentCard
              key={card.tier}
              variant={card.variant}
              cardTier={card.tier}
              maskedNumber={card.maskedNumber}
              holderName={card.holder}
              expiryDate={card.expiry}
              className="w-[84vw] snap-start sm:w-[360px]"
            />
          ))}
        </div>
      </section>

      <div className="grid gap-3.5 md:grid-cols-2">
        <CreditLimitCard used={CREDIT_LIMIT.used} total={CREDIT_LIMIT.total} />
        <MonthlySpendingCard amount="$4,280.40" trendLabel="12% vs anterior" />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <ExpenseProjectionCard />

        <SettingsSection title="Seguridad" icon={Lock} iconColor="#6c72cb">
          {SECURITY_ROWS.map((row) => (
            <SettingRow
              key={row.key}
              label={row.label}
              icon={row.icon}
              controlId={`security-${row.key}`}
            >
              <Switch
                id={`security-${row.key}`}
                checked={security[row.key]}
                onCheckedChange={(checked) =>
                  setSecurity((prev) => ({ ...prev, [row.key]: checked }))
                }
              />
            </SettingRow>
          ))}
          <button
            type="button"
            aria-label="Solicitar reemplazo de tarjeta"
            className="mt-3 h-[52px] rounded-[14px] bg-[linear-gradient(90deg,var(--violet-ink)_0%,var(--highlight)_100%)] text-[13px] font-bold tracking-[0.14em] text-white shadow-[0_4px_20px_rgba(108,114,203,0.42)] outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-[#0b0c1a]"
          >
            REEMPLAZAR TARJETA
          </button>
        </SettingsSection>
      </div>

      <section>
        <SectionHeading title="Transacciones Recientes" />
        <div className="flex flex-col gap-2.5">
          <TransactionItemExpense
            merchant="Amazon Marketplace"
            category="Compras"
            time="Hoy, 14:32"
            amount="-$124.99"
          />
          <TransactionItemExpense
            merchant="The Diner"
            category="Alimentos"
            time="Ayer, 21:15"
            amount="-$42.00"
            icon={Utensils}
          />
        </div>
      </section>
    </div>
  );
}
