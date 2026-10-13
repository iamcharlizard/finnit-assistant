import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

import { BankConnectionCard } from '@/components/bank-connect/bank-connection-card';
import { fetchBankConnections } from '@/lib/bank-connect/connections';

export const metadata: Metadata = { title: 'Bancos conectados' };

export default async function BanksPage() {
  const connections = await fetchBankConnections();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <TitleLg as="h1">Bancos conectados</TitleLg>
        <Button variant="secondary" asChild>
          <Link href="/settings/banks/connect">
            <Plus className="size-4" /> Conectar banco
          </Link>
        </Button>
      </div>

      {connections.length === 0 ? (
        <BodyMd className="rounded-card bg-track p-6 text-center text-on-surface-variant">
          Aún no conectas ningún banco. Conéctalo para importar tus movimientos
          automáticamente.
        </BodyMd>
      ) : (
        connections.map((connection) => (
          <BankConnectionCard key={connection.id} connection={connection} />
        ))
      )}
    </div>
  );
}
