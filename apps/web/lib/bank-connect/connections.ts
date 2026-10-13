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
  accounts: {
    id: string;
    name: string | null;
    mask: string | null;
    type: string | null;
    balance: number | null;
    accountId: string | null;
  }[];
}

/** The user's bank connections, for server components. */
export async function fetchBankConnections(): Promise<BankConnectionView[]> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const result = await apiGraphql<{ bankConnections: BankConnectionView[] }>(
    `query BankConnections {
      bankConnections {
        id institution status errorMessage lastSyncedAt
        accounts { id name mask type balance accountId }
      }
    }`,
    {},
    token,
  );
  if (!result.data)
    throw new Error(result.errors?.[0]?.message ?? 'Could not load banks');
  return result.data.bankConnections;
}
