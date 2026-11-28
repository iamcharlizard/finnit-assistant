import 'server-only';

import { cookies } from 'next/headers';

import { apiGraphql } from '@/lib/api/finnit-api';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';

export interface BankConnectionView {
  id: string;
  institution: string | null;
  status: 'active' | 'error' | 'revoked';
  errorMessage: string | null;
  lastSyncedAt: string | null;
  /** The user paused it ("Pausar sincronización"). */
  syncPaused: boolean;
  accounts: {
    id: string;
    name: string | null;
    mask: string | null;
    type: string | null;
    balance: number | null;
    accountId: string | null;
  }[];
}

export interface BankConnectionsData {
  connections: BankConnectionView[];
  /** False while an admin has bank sync turned off. */
  syncAvailable: boolean;
}

/** The user's bank connections, for server components. */
export async function fetchBankConnections(): Promise<BankConnectionsData> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const result = await apiGraphql<{
    bankConnections: BankConnectionView[];
    bankSyncAvailable: boolean;
  }>(
    `query BankConnections {
      bankConnections {
        id institution status errorMessage lastSyncedAt syncPaused
        accounts { id name mask type balance accountId }
      }
      bankSyncAvailable
    }`,
    {},
    token,
  );
  if (!result.data)
    throw new Error(result.errors?.[0]?.message ?? 'Could not load banks');
  return {
    connections: result.data.bankConnections,
    syncAvailable: result.data.bankSyncAvailable,
  };
}
