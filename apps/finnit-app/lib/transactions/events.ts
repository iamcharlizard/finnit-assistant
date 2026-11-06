import * as React from 'react';

/**
 * "A movement changed" (edited, renamed, deleted, created): the detail and
 * forms are routes, so instead of the web drawer's onChange callback they
 * announce it here and the lists on screen reload.
 */
const listeners = new Set<(id: string | null) => void>();

export function emitTransactionsChanged(id: string | null = null) {
  listeners.forEach((listener) => listener(id));
}

export function useOnTransactionsChanged(callback: (id: string | null) => void) {
  const latest = React.useRef(callback);
  latest.current = callback;
  React.useEffect(() => {
    const listener = (id: string | null) => latest.current(id);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
