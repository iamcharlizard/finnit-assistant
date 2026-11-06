'use client';

import * as React from 'react';

/**
 * Whether a media query matches, kept in sync with the window. False on the
 * server and on the first client render, so hydration matches.
 */
export function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
