'use client';

import * as React from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { previewAlias, regexErrorOf } from '@/lib/aliases/api';
import {
  PREVIEW_DEBOUNCE_MS,
  previewInput,
  previewKey,
  type AliasForm,
} from '@/lib/aliases/form';
import type { AliasPreview } from '@/lib/aliases/types';
import { gql } from '@/lib/graphql/client';

export type AliasPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; preview: AliasPreview }
  | { status: 'error'; regexError: string | null };

/**
 * Live "Coincide con N movimientos" for the alias being edited: asks the API
 * once the match type and pattern stop changing for a moment. Only the
 * latest answer is kept.
 */
export function useAliasPreview({
  matchType,
  pattern,
}: Pick<AliasForm, 'matchType' | 'pattern'>): AliasPreviewState {
  const input = React.useMemo(
    () => previewInput({ matchType, pattern }),
    [matchType, pattern],
  );
  const key = previewKey(input);
  const debounced = useDebouncedValue(input, PREVIEW_DEBOUNCE_MS);
  const [result, setResult] = React.useState<{
    key: string;
    state: AliasPreviewState;
  } | null>(null);

  React.useEffect(() => {
    const requestKey = previewKey(debounced);
    if (!debounced || !requestKey) return;
    let cancelled = false;
    previewAlias(debounced, gql)
      .then((preview) => {
        if (!cancelled) {
          setResult({ key: requestKey, state: { status: 'ready', preview } });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            state: { status: 'error', regexError: regexErrorOf(error) },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  if (!key) return { status: 'idle' };
  if (result?.key === key) return result.state;
  return { status: 'loading' };
}
