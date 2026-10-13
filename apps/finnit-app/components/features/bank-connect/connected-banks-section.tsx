import { ActivityIndicator } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useQuery } from 'urql';

import { TwPressable, TwText, TwView } from '@/lib/tw';
import {
  BANK_CONNECTIONS_QUERY,
  type BankConnectionStatus,
  type BankConnectionsResult,
} from '@/lib/graphql/queries/bank-connect';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';

const STATUS_LABEL: Record<BankConnectionStatus, string> = {
  active: 'Activa',
  error: 'Requiere atención',
  revoked: 'Desconectada',
};

function formatSyncedAt(iso: string | null): string {
  if (!iso) return 'Sin sincronizar';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Sin sincronizar';
  return `Actualizado el ${date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
}

/** Settings section: the user's bank connections and the "Conectar banco" action. */
export function ConnectedBanksSection() {
  const P = useBankConnectPalette();
  const [{ data, fetching, error }] = useQuery<BankConnectionsResult>({
    query: BANK_CONNECTIONS_QUERY,
    requestPolicy: 'cache-and-network',
  });
  const connections = data?.bankConnections ?? [];

  return (
    <TwView className="rounded-[24px] p-4 gap-3" style={P.card}>
      <TwView className="flex-row items-center gap-3 mb-1">
        <SymbolView name="building.columns.fill" size={20} tintColor={P.primary} accessibilityLabel="" />
        <TwText accessibilityRole="header" style={{ fontFamily: 'Ubuntu Bold', fontSize: 16, color: P.onSurface }}>
          Bancos conectados
        </TwText>
      </TwView>

      {fetching && !data ? (
        <ActivityIndicator color={P.primary} accessibilityLabel="Cargando bancos conectados" />
      ) : null}
      {error && !data ? (
        <TwText style={{ fontFamily: 'Ubuntu', fontSize: 14, color: P.onSurfaceVariant }}>
          No pudimos cargar tus bancos conectados.
        </TwText>
      ) : null}

      {connections.map((connection) => {
        const statusColor = connection.status === 'active' ? P.success : P.error;
        const accounts = connection.accounts.length;
        return (
          <TwView
            key={connection.id}
            className="flex-row items-center gap-3 px-3 rounded-xl"
            style={{ backgroundColor: P.rowBg, minHeight: 60 }}
            accessible
            accessibilityLabel={`${connection.institution ?? 'Banco'}, ${STATUS_LABEL[connection.status]}, ${accounts} ${accounts === 1 ? 'cuenta' : 'cuentas'}`}
          >
            <TwView className="flex-1 py-2">
              <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 15, color: P.onSurface }}>
                {connection.institution ?? 'Banco'}
              </TwText>
              <TwText style={{ fontFamily: 'Ubuntu', fontSize: 12, color: P.onSurfaceVariant, marginTop: 2 }}>
                {`${accounts} ${accounts === 1 ? 'cuenta' : 'cuentas'} · ${formatSyncedAt(connection.lastSyncedAt)}`}
              </TwText>
            </TwView>
            <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 12, color: statusColor }}>
              {STATUS_LABEL[connection.status]}
            </TwText>
          </TwView>
        );
      })}

      <TwPressable
        className="flex-row items-center justify-between px-3 rounded-xl active:opacity-70"
        style={{ backgroundColor: P.rowBg, minHeight: 52 }}
        onPress={() => router.push('/connect-bank')}
        accessibilityRole="button"
        accessibilityLabel="Conectar banco"
        accessibilityHint="Abre el asistente para conectar tu banco"
      >
        <TwView className="flex-row items-center gap-3 flex-1">
          <SymbolView name="plus.circle.fill" size={20} tintColor={P.primary} accessibilityLabel="" />
          <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 16, color: P.primary }}>Conectar banco</TwText>
        </TwView>
        <SymbolView name="chevron.right" size={14} tintColor={P.onSurfaceVariant} accessibilityLabel="" />
      </TwPressable>
    </TwView>
  );
}
