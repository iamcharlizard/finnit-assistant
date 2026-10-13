import Link from 'next/link';
import { CalendarDays, ChartLine, Landmark, Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Card } from '@finnit/ui/components/ui/card';

const STEPS = [
  {
    icon: Landmark,
    text: 'Conecta tu banco: importamos tus cuentas, saldos y movimientos.',
  },
  {
    icon: ChartLine,
    text: 'Ve en qué se va tu dinero cada mes, por categoría.',
  },
  {
    icon: CalendarDays,
    text: 'Ten a la vista tus pagos recurrentes y fechas de tarjeta.',
  },
];

/** First visit: no accounts and no movements yet. */
export function DashboardWelcome({ firstName }: { firstName: string }) {
  return (
    <Card className="mx-auto max-w-2xl items-start gap-5 p-6 sm:p-8">
      <div>
        <h1 className="mb-2 text-[28px] leading-9 font-bold text-on-background">
          Hola, {firstName}. Te damos la bienvenida a Finnit
        </h1>
        <p className="text-[15px] text-on-surface-variant">
          Aún no tienes cuentas ni movimientos. Empieza conectando tu banco;
          aquí verás tus saldos, gastos del mes y próximos pagos.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {STEPS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <Icon
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-brand-ink"
            />
            <span className="text-on-background">{text}</span>
          </li>
        ))}
      </ul>
      <Button asChild>
        <Link href="/settings/banks/connect">
          <Plus className="size-4" /> Conectar banco
        </Link>
      </Button>
    </Card>
  );
}
