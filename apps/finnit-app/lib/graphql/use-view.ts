import * as React from 'react';
import { useQuery, type AnyVariables } from 'urql';

import type { Localizer } from '@finnit/core/i18n/translator';

import { useLocalizer } from '@/lib/i18n/i18n-provider';

interface ViewQuery<Result, Variables extends AnyVariables, View> {
  query: string;
  variables: Variables;
  /** Turns the API's data into what the screen renders (core's view builders). */
  build: (data: Result, l: Localizer) => View;
  pause?: boolean;
}

/**
 * The mobile counterpart of the web's `lib/<area>/load.ts`: one request
 * (urql, cached; shows the cache first and updates it), then core's view
 * builder in the user's language. `refresh` forces a new request (pull to
 * refresh, after a change).
 */
export function useView<Result, Variables extends AnyVariables, View>({
  query,
  variables,
  build,
  pause,
}: ViewQuery<Result, Variables, View>) {
  const l = useLocalizer();
  const [result, reexecute] = useQuery<Result, Variables>({ query, variables, pause });
  const [refreshing, setRefreshing] = React.useState(false);

  const fresh = React.useMemo(
    () => (result.data ? build(result.data, l) : null),
    // `build` is usually an inline closure over the same inputs as `variables`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result.data, l],
  );
  // New variables (e.g. other filters): keep showing the last view until
  // the new one arrives, so the screen (and a focused search box) stays.
  const last = React.useRef<View | null>(null);
  if (fresh) last.current = fresh;
  const view = fresh ?? (result.fetching ? last.current : null);

  const refresh = React.useCallback(() => {
    setRefreshing(true);
    reexecute({ requestPolicy: 'network-only' });
  }, [reexecute]);

  React.useEffect(() => {
    if (!result.fetching) setRefreshing(false);
  }, [result.fetching]);

  return {
    view,
    /** First load, nothing to show yet. */
    loading: !view && result.fetching,
    error: !view ? result.error : undefined,
    refreshing,
    refresh,
  };
}
