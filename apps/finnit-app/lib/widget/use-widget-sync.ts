import * as React from 'react';
import { AppState, Platform } from 'react-native';
import { useClient } from 'urql';

import { useAuth } from '@/contexts/AuthContext';
import { useOnTransactionsChanged } from '@/lib/transactions/events';
import { onWidgetSyncRequest, syncWidget } from './sync';

/** How long changes are gathered before one sync. */
const DEBOUNCE = 1500;

/**
 * Keeps the widget up to date while signed in: on start, when the app
 * comes back to the foreground, after movements or payments change and
 * whenever `requestWidgetSync()` is called.
 */
export function useWidgetSync() {
  const { status } = useAuth();
  const client = useClient();
  const signedIn = status === 'signedIn';
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = React.useCallback(() => {
    if (!signedIn || Platform.OS !== 'ios') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void syncWidget(client).catch(() => {});
    }, DEBOUNCE);
  }, [client, signedIn]);

  React.useEffect(() => {
    schedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule();
    });
    const unsubscribe = onWidgetSyncRequest(schedule);
    return () => {
      subscription.remove();
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schedule]);

  useOnTransactionsChanged(schedule);
}
