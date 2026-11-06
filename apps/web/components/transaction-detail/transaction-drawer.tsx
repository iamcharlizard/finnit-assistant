'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

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

export interface OpenOptions {
  /**
   * Called after the movement changed (edited, deleted, converted…), for
   * lists that keep their rows on the client (e.g. Clasificar reloads
   * them, so a movement that got a category leaves the list).
   */
  onChange?: () => void;
}

interface DrawerApi {
  /** Shows the movement's detail without leaving the list. */
  open: (id: string, options?: OpenOptions) => void;
}

const DrawerContext = React.createContext<DrawerApi | null>(null);

/**
 * Opens a movement from a list: a drawer on the right when the sidebar
 * shows (lg), a modal below. Movements have no page of their own.
 */
export function useTransactionDrawer(): DrawerApi {
  const drawer = React.use(DrawerContext);
  if (!drawer) {
    throw new Error(
      'useTransactionDrawer must be used inside TransactionDrawerProvider',
    );
  }
  return drawer;
}

/**
 * Holds the open movement and renders its detail in a drawer or a modal.
 * Changes made there reload the detail, the server-rendered page behind
 * it and, through `onChange`, the list that opened it.
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
  const onChange = React.useRef<(() => void) | undefined>(undefined);

  const load = React.useCallback((target: string) => {
    const current = ++request.current;
    startLoading(async () => {
      const next = await loadTransactionDetailAction(target);
      if (current === request.current) setResult(next);
    });
  }, []);

  const api = React.useMemo<DrawerApi>(
    () => ({
      open: (target, options) => {
        onChange.current = options?.onChange;
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
      // Another movement (a transfer's other side), for the same list.
      show: (target) => {
        setId(target);
        setResult(null);
        load(target);
      },
      refresh: () => {
        if (id) load(id);
        router.refresh();
        onChange.current?.();
      },
      close: ({ deleted } = {}) => {
        close();
        if (deleted) {
          router.refresh();
          onChange.current?.();
        }
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
            {body}
          </DialogContent>
        </Dialog>
      )}
    </DrawerContext>
  );
}
