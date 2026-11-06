'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExternalLink, Loader2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@finnit/ui/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@finnit/ui/components/ui/sheet';

import {
  loadTransactionDetailAction,
  type DetailResult,
} from '@/app/transaction-actions';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useLocalizer } from '@/lib/i18n/client';
import { DetailHostProvider, type DetailHost } from './detail-host';
import { TransactionDetailScreen } from './transaction-detail-screen';

interface DrawerApi {
  /** Shows the movement's detail without leaving the list. */
  open: (id: string) => void;
}

const DrawerContext = React.createContext<DrawerApi | null>(null);

/**
 * Opens a movement from a list: a drawer on the right when the sidebar
 * shows (lg), a modal below. Falls back to the movement's page outside
 * the provider.
 */
export function useTransactionDrawer(): DrawerApi {
  const drawer = React.use(DrawerContext);
  const router = useRouter();
  return React.useMemo(
    () => drawer ?? { open: (id) => router.push(`/transactions/${id}`) },
    [drawer, router],
  );
}

/**
 * Holds the open movement and renders its detail (the same screen as its
 * page) in a drawer or a modal. Changes made there reload the detail and
 * the page behind it.
 */
export function TransactionDrawerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const wide = useMediaQuery('(min-width: 64rem)');
  const t = useTranslations('transaction.drawer');
  const { t: translate } = useLocalizer();
  const [id, setId] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<DetailResult | null>(null);
  const [loading, startLoading] = React.useTransition();
  const request = React.useRef(0);

  const load = React.useCallback((target: string) => {
    const current = ++request.current;
    startLoading(async () => {
      const next = await loadTransactionDetailAction(target);
      if (current === request.current) setResult(next);
    });
  }, []);

  const api = React.useMemo<DrawerApi>(
    () => ({
      open: (target) => {
        setId(target);
        setResult(null);
        load(target);
      },
    }),
    [load],
  );

  const close = React.useCallback(() => {
    request.current += 1;
    setId(null);
  }, []);

  const host = React.useMemo<DetailHost>(
    () => ({
      mode: 'drawer',
      refresh: () => {
        if (id) load(id);
        router.refresh();
      },
      close: ({ deleted } = {}) => {
        close();
        if (deleted) router.refresh();
      },
    }),
    [id, load, router, close],
  );

  const body =
    result?.ok === true ? (
      <DetailHostProvider value={host}>
        <div aria-busy={loading} className="@container">
          <TransactionDetailScreen key={id} data={result.data} />
        </div>
      </DetailHostProvider>
    ) : result?.ok === false ? (
      <p role="alert" className="p-4 text-sm text-expense">
        {t(result.error === 'notFound' ? 'notFound' : 'failed')}
      </p>
    ) : (
      <p className="flex items-center gap-2 p-4 text-sm text-on-surface-variant">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        {translate('common.loading')}
      </p>
    );

  const fullPage = id ? (
    <Button variant="ghost" size="sm" asChild className="self-start">
      <Link href={`/transactions/${id}`} onClick={close}>
        <ExternalLink aria-hidden /> {t('openPage')}
      </Link>
    </Button>
  ) : null;

  return (
    <DrawerContext value={api}>
      {children}
      {wide ? (
        <Sheet open={id !== null} onOpenChange={(open) => !open && close()}>
          <SheetContent
            side="right"
            closeLabel={translate('common.close')}
            className="w-[min(40rem,100vw)] max-w-none gap-2 overflow-y-auto px-5 pt-5 pb-8"
          >
            <SheetTitle className="pr-12">{t('title')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('description')}
            </SheetDescription>
            {fullPage}
            {body}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={id !== null} onOpenChange={(open) => !open && close()}>
          <DialogContent
            closeLabel={translate('common.close')}
            className="gap-2 sm:max-w-2xl"
          >
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('description')}
            </DialogDescription>
            {fullPage}
            {body}
          </DialogContent>
        </Dialog>
      )}
    </DrawerContext>
  );
}
