import 'server-only';

import { cookies } from 'next/headers';

import { apiGraphql } from '@/lib/api/finnit-api';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';

/** What the app shell needs on every page, in one request. */
export interface ShellCounts {
  /** Notifications not read yet (scheduled or sent), for the bell's badge. */
  unread: number;
  /** Whether "Pago a tarjeta" belongs in the "+" menu. */
  hasCreditCard: boolean;
}

/**
 * The shell's counts. They are secondary: any failure counts as zero / no
 * card (the shortcut is still in "Nuevo movimiento" once there is one).
 */
export async function loadShellCounts(): Promise<ShellCounts> {
  const none = { unread: 0, hasCreditCard: false };
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return none;
  const result = await apiGraphql<{
    scheduled: { totalCount: number };
    sent: { totalCount: number };
    cards: { totalCount: number };
  }>(
    `query ShellCounts {
      scheduled: notifications(status: scheduled, first: 1) { totalCount }
      sent: notifications(status: sent, first: 1) { totalCount }
      cards: accounts(first: 1, type: credit, archived: false) { totalCount }
    }`,
    {},
    token,
  ).catch(() => null);
  if (!result?.data) return none;
  return {
    unread: result.data.scheduled.totalCount + result.data.sent.totalCount,
    hasCreditCard: result.data.cards.totalCount > 0,
  };
}
