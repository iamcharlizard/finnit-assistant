'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Landmark, RefreshCw } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { GlassCard } from '@finnit/ui/components/ui/glass-card';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

import type { BankConnectionView } from '@/lib/bank-connect/connections';
import { dayKeyOf, longDate, timeOf, todayKey } from '@/lib/finance/dates';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import type { Locale } from '@/lib/i18n/locales';

/** "13 de octubre, 08:15" in Mexico City, the same on server and browser. */
function syncedAt(iso: string, locale: Locale): string {
  const time = timeOf(iso);
  const date = longDate(dayKeyOf(iso), todayKey(), locale);
  return time ? `${date}, ${time}` : date;
}

export function BankConnectionCard({
  connection,
}: {
  connection: BankConnectionView;
}) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
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
      const { imported } = data.syncBankConnection;
      setMessage(
        imported
          ? t('banks.imported', { count: imported })
          : t('banks.upToDate'),
      );
      router.refresh();
    } catch (error) {
      setMessage(requestErrorMessage(error, t));
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
            {connection.institution ?? t('banks.fallbackName')}
          </TitleLg>
          <BodyMd className="text-[13px] text-on-surface-variant">
            {[
              t('banks.linkedSummary', {
                linked: String(linked),
                total: connection.accounts.length,
              }),
              connection.lastSyncedAt
                ? t('banks.lastSync', {
                    date: syncedAt(connection.lastSyncedAt, locale),
                  })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </BodyMd>
        </div>
        <Badge variant={connection.status === 'active' ? 'success' : 'expense'}>
          {connection.status === 'active'
            ? t('banks.active')
            : t('banks.needsAttention')}
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
        {syncing ? t('banks.syncing') : t('banks.syncNow')}
      </Button>
    </GlassCard>
  );
}
