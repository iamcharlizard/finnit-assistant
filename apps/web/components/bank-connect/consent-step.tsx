import Link from 'next/link';
import { Landmark, LockKeyhole, ShieldCheck, Unplug } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

const POINTS = [
  {
    icon: LockKeyhole,
    text: 'Tu usuario y contraseña del banco van directo de tu dispositivo a Syncfy, nuestro proveedor de conexión bancaria. Finnit nunca los ve ni los guarda.',
  },
  {
    icon: Landmark,
    text: 'Finnit solo guarda las cuentas, saldos y movimientos que tú decidas importar.',
  },
  {
    icon: Unplug,
    text: 'Puedes desconectar tu banco cuando quieras desde Ajustes.',
  },
];

export function ConsentStep({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent-neon/15 text-accent-neon">
          <ShieldCheck aria-hidden className="size-6" />
        </span>
        <TitleLg as="h2">Antes de conectar tu banco</TitleLg>
      </div>

      <ul className="flex flex-col gap-4">
        {POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3">
            <Icon
              aria-hidden
              className="mt-0.5 size-5 shrink-0 text-brand-ink"
            />
            <BodyMd className="text-on-surface-variant">{text}</BodyMd>
          </li>
        ))}
      </ul>

      <BodyMd className="text-[13px] text-on-surface-variant">
        Al continuar aceptas que Syncfy acceda a la información de tu banca en
        línea para sincronizarla con Finnit.
      </BodyMd>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" asChild>
          <Link href="/settings/banks">Cancelar</Link>
        </Button>
        <Button variant="secondary" onClick={onAccept}>
          Aceptar y continuar
        </Button>
      </div>
    </div>
  );
}
