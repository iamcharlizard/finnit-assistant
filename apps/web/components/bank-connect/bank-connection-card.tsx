'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Landmark, RefreshCw } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { GlassCard } from '@finnit/ui/components/ui/glass-card';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

import type { BankConnectionView } from '@/lib/bank-connect/connections';
import { gql } from '@/lib/graphql/client';

const dateTime = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
});

export function BankConnectionCard({
  connection,
}: {
  connection: BankConnectionView;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const linked = connection.accounts.filter((a) => a.accountId).length;

  async function sync() {
    setSyncing(true);
    setMessage(null);
    try {
      const data = await gql<{ syncBankConnection: { imported: number } }>(
        'mutation SyncBank($id: ID!) { syncBankConnection(id: $id, refreshFromBank: true) { imported } }',
        { id: connection.id },
      );
      setMessage(
        data.syncBankConnection.imported
          ? `Importamos ${data.syncBankConnection.imported} movimiento(s) nuevo(s).`
          : 'Todo al día. Pedimos datos nuevos a tu banco; llegarán en la próxima sincronización.',
      );
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-3 rounded-card p-5">
      <div className="flex items-start gap-3">
        <Landmark aria-hidden className="mt-1 size-6 shrink-0 text-brand-ink" />
        <div className="flex-1">
          <TitleLg as="h2" className="text-lg">
            {connection.institution ?? 'Banco'}
          </TitleLg>
          <BodyMd className="text-[13px] text-on-surface-variant">
            {linked} de {connection.accounts.length} cuenta(s) importándose
            {connection.lastSyncedAt
              ? ` · Última sincronización: ${dateTime.format(new Date(connection.lastSyncedAt))}`
              : ''}
          </BodyMd>
        </div>
        <Badge variant={connection.status === 'active' ? 'success' : 'expense'}>
          {connection.status === 'active' ? 'Activo' : 'Requiere atención'}
        </Badge>
      </div>

      {connection.errorMessage ? (
        <p className="flex gap-2 text-[13px] text-expense">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {connection.errorMessage}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-[13px] text-on-surface-variant">
          {message}
        </p>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        className="self-end"
        disabled={syncing}
        onClick={() => void sync()}
      >
        <RefreshCw className={syncing ? 'size-4 animate-spin' : 'size-4'} />
        {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
      </Button>
    </GlassCard>
  );
}
