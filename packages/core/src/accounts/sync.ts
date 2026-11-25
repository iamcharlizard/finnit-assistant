/**
 * How an account updates: from a live bank connection (automatic, with
 * when it last did, or that the last try failed) or by hand. Shown as a
 * pill on the home's accounts and in "Cuentas y tarjetas".
 */
import type { Localizer } from '../i18n/translator';

/** What a bank connection tells about its accounts' updates. */
export interface SyncConnection {
  status?: 'active' | 'error' | 'revoked' | null;
  /** ISO date-time of the last successful update. */
  lastSyncedAt?: string | null;
  accounts: ReadonlyArray<{ accountId: string | null }>;
}

export interface AccountSync {
  kind: 'manual' | 'auto' | 'failed';
  /** "Manual", "Automática · hace 2 h", "No se actualizó". */
  label: string;
}

/** "hace un momento", "hace 5 min", "hace 2 h", "hace 3 d". */
export function syncAgoLabel(iso: string, now: Date, { t }: Localizer): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000),
  );
  if (minutes < 1) return t('accounts.sync.ago.now');
  if (minutes < 60) return t('accounts.sync.ago.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('accounts.sync.ago.hours', { count: hours });
  return t('accounts.sync.ago.days', { count: Math.floor(hours / 24) });
}

/**
 * An account of a disconnected (revoked) bank no longer updates on its
 * own: manual. A connection whose last try failed: failed.
 */
export function accountSync(
  accountId: string,
  connections: ReadonlyArray<SyncConnection>,
  now: Date,
  l: Localizer,
): AccountSync {
  const { t } = l;
  const connection = connections.find(
    (c) =>
      c.status !== 'revoked' &&
      c.accounts.some((a) => a.accountId === accountId),
  );
  if (!connection) return { kind: 'manual', label: t('accounts.sync.manual') };
  if (connection.status === 'error') {
    return { kind: 'failed', label: t('accounts.sync.failed') };
  }
  return {
    kind: 'auto',
    label: connection.lastSyncedAt
      ? t('accounts.sync.auto', {
          ago: syncAgoLabel(connection.lastSyncedAt, now, l),
        })
      : t('accounts.sync.autoPending'),
  };
}
