'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Where the movement's detail is shown: its own page (/transactions/[id])
 * or the drawer (modal on small screens) opened from a list. The screen
 * asks the host to reload its data after a change and to close itself
 * (back on the page; dismiss in the drawer).
 */
export interface DetailHost {
  mode: 'page' | 'drawer';
  /** Reloads the detail (and whatever list is behind it). */
  refresh: () => void;
  /** Leaves the detail; `deleted`: the movement is gone. */
  close: (options?: { deleted?: boolean }) => void;
}

const DetailHostContext = React.createContext<DetailHost | null>(null);

export function DetailHostProvider({
  value,
  children,
}: {
  value: DetailHost;
  children: React.ReactNode;
}) {
  return <DetailHostContext value={value}>{children}</DetailHostContext>;
}

/** The host; on the page, the router (refresh, back, /history after deleting). */
export function useDetailHost(): DetailHost {
  const host = React.use(DetailHostContext);
  const router = useRouter();
  return React.useMemo(
    () =>
      host ?? {
        mode: 'page',
        refresh: () => router.refresh(),
        close: ({ deleted } = {}) => {
          if (deleted) {
            router.replace('/history');
            router.refresh();
          } else if (window.history.length > 1) router.back();
          else router.push('/history');
        },
      },
    [host, router],
  );
}
