import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

import { BankConnectionCard } from '@/components/bank-connect/bank-connection-card';
import { fetchBankConnections } from '@/lib/bank-connect/connections';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('pageTitles.banks') };
}

export default async function BanksPage() {
  const [connections, t] = await Promise.all([
    fetchBankConnections(),
    getTranslations('banks'),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <TitleLg as="h1">{t('title')}</TitleLg>
        <Button variant="secondary" asChild>
          <Link href="/settings/banks/connect">
            <Plus className="size-4" /> {t('connect')}
          </Link>
        </Button>
      </div>

      {connections.length === 0 ? (
        <BodyMd className="rounded-card bg-track p-6 text-center text-on-surface-variant">
          {t('empty')}
        </BodyMd>
      ) : (
        connections.map((connection) => (
          <BankConnectionCard key={connection.id} connection={connection} />
        ))
      )}
    </div>
  );
}
