'use client';

import * as React from 'react';

/**
 * Caps an element's height to the space left between its top and the bottom
 * of the window (minus `bottomGap`), so a scrolling list fills the screen
 * without making the page scroll. Only when the content column (the nearest
 * `@container`) is at least `minWidth` wide, matching the screens' `@3xl:`
 * layouts; below, the element keeps its CSS max height. It never goes under
 * `minHeight`: on a short window the page scrolls instead.
 */
export function useFillViewport<T extends HTMLElement>({
  bottomGap,
  minHeight,
  minWidth = 768,
}: {
  bottomGap: number;
  minHeight: number;
  minWidth?: number;
}) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // The column changes width with the window and with the sidebar.
    const column = element.closest<HTMLElement>('.\\@container');

    const fit = () => {
      const width = column?.clientWidth ?? window.innerWidth;
      if (width < minWidth) {
        element.style.maxHeight = '';
        return;
      }
      // From the top of the page, so scrolling doesn't change the result.
      const top = element.getBoundingClientRect().top + window.scrollY;
      const available = window.innerHeight - top - bottomGap;
      element.style.maxHeight = `${Math.max(minHeight, Math.floor(available))}px`;
    };

    fit();
    // What sits above it can change size (another account, fonts loading).
    const observer = new ResizeObserver(fit);
    if (element.parentElement?.parentElement) {
      observer.observe(element.parentElement.parentElement);
    }
    if (column) observer.observe(column);
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [bottomGap, minHeight, minWidth]);

  return ref;
}
