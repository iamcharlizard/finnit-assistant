'use client';

import * as React from 'react';

import { NAV_GROUPS_COOKIE, openGroupsCookieValue } from '@finnit/core/nav/sidebar';
import type { NavSectionKey } from '@/lib/nav/sections';
import { preferenceCookie } from '@finnit/core/theme/app-theme';

/**
 * Which sidebar groups are open: the ones the user left open (cookie, read
 * by the server so the first render matches) plus the one holding the
 * current page, which opens when the user navigates into it.
 */
export function useNavGroups(
  initialOpen: ReadonlyArray<string>,
  activeGroup: NavSectionKey | null,
) {
  const [open, setOpen] = React.useState<ReadonlySet<NavSectionKey>>(
    () =>
      new Set([
        ...(initialOpen as NavSectionKey[]),
        ...(activeGroup ? [activeGroup] : []),
      ]),
  );

  // Entering another group's page opens it (closing stays the user's call).
  const [seenActive, setSeenActive] = React.useState(activeGroup);
  if (seenActive !== activeGroup) {
    setSeenActive(activeGroup);
    if (activeGroup && !open.has(activeGroup)) {
      setOpen(new Set([...open, activeGroup]));
    }
  }

  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.cookie = preferenceCookie(
      NAV_GROUPS_COOKIE,
      openGroupsCookieValue(open),
    );
  }, [open]);

  const toggle = React.useCallback((key: NavSectionKey) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return { open, toggle };
}
