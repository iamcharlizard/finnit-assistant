'use client';

import * as React from 'react';

/**
 * The container of a movement's detail (the drawer, or a modal on small
 * screens). The screen asks it to reload after a change and to close.
 */
export interface DetailHost {
  /** Shows another movement's detail here (e.g. a transfer's other side). */
  show: (id: string) => void;
  /** Reloads the detail and tells the list behind it. */
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

export function useDetailHost(): DetailHost {
  const host = React.use(DetailHostContext);
  if (!host) {
    throw new Error('useDetailHost must be used inside the detail drawer');
  }
  return host;
}
