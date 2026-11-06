'use client';

import * as React from 'react';

import { PAGE_HEADER_CLASS } from '@/components/header-chrome';

/** Space between the header and the toolbar (the screen's `gap-6`). */
const BELOW_HEADER_PX = 24;
/** Space between the toolbar and a day's sticky heading. */
const BELOW_TOOLBAR_PX = 12;

export const TOOLBAR_ATTR = 'data-history-toolbar';

/**
 * Where the history's sticky parts stop, measured from the real header
 * (its height changes with the subtitle and the screen size), so the
 * toolbar and the aside stick exactly where they already are and never
 * jump: `--history-top` under the header and `--history-day-top` under the
 * toolbar, set on the screen's root.
 */
export function useStickyTops(root: React.RefObject<HTMLElement | null>) {
  React.useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const header = element.querySelector<HTMLElement>(`.${PAGE_HEADER_CLASS}`);
    const toolbar = element.querySelector<HTMLElement>(`[${TOOLBAR_ATTR}]`);

    const update = () => {
      // The header is sticky: its bottom is the same at any scroll.
      const top =
        (header?.getBoundingClientRect().bottom ?? 72) + BELOW_HEADER_PX;
      const dayTop = top + (toolbar?.offsetHeight ?? 0) + BELOW_TOOLBAR_PX;
      element.style.setProperty('--history-top', `${Math.round(top)}px`);
      element.style.setProperty('--history-day-top', `${Math.round(dayTop)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    if (header) observer.observe(header);
    if (toolbar) observer.observe(toolbar);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [root]);
}
