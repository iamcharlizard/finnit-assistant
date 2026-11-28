import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Info, Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

import { ManualAccountLink } from '@/components/accounts/manual-account-link';
import { BankConnectionCard } from '@/components/bank-connect/bank-connection-card';
import { fetchBankConnections } from '@/lib/bank-connect/connections';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.banks') };
}

export default async function BanksPage() {
  const [{ connections, syncAvailable }, t] = await Promise.all([
    fetchBankConnections(),
    getTranslations('banks'),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <TitleLg as="h1">{t('title')}</TitleLg>
        {syncAvailable ? (
          <Button variant="secondary" asChild>
            <Link href="/settings/banks/connect">
              <Plus className="size-4" /> {t('connect')}
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            <Plus className="size-4" /> {t('connect')}
          </Button>
        )}
      </div>

      {syncAvailable ? null : (
        <p
          role="status"
          className="flex gap-2 rounded-card bg-track p-4 text-[13px] text-on-surface-variant"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('unavailable')}
        </p>
      )}

      {connections.length === 0 ? (
        <BodyMd className="rounded-card bg-track p-6 text-center text-on-surface-variant">
          {t('empty')}
        </BodyMd>
      ) : (
        connections.map((connection) => (
          <BankConnectionCard
            key={connection.id}
            connection={connection}
            syncAvailable={syncAvailable}
          />
        ))
      )}

      <ManualAccountLink />
    </div>
  );
}
