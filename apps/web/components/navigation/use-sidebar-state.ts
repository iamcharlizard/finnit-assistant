'use client';

import * as React from 'react';

import { SIDEBAR_COOKIE, sidebarCookieValue } from '@/lib/nav/sidebar';
import { preferenceCookie } from '@/lib/theme/app-theme';

/**
 * The user's choice for the sidebar from lg up (collapsed or expanded). It
 * starts from the cookie the server read, so the first render already has
 * the right width, and is saved back to the cookie on every change.
 */
export function useSidebarState(initialCollapsed: boolean) {
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const toggle = React.useCallback(() => setCollapsed((c) => !c), []);

  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.cookie = preferenceCookie(
      SIDEBAR_COOKIE,
      sidebarCookieValue(collapsed),
    );
  }, [collapsed]);

  return { collapsed, toggle };
}

/** Typing in a field must not toggle the menu. */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
