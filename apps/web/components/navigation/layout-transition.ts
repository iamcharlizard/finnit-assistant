import { flushSync } from 'react-dom';

/** On <html> while a layout transition runs; scopes its CSS (app/globals.css). */
const ACTIVE_CLASS = 'vt-layout';

let running = 0;

/**
 * Runs a state update that reflows the page (the sidebar collapsing or
 * expanding) as a view transition: the browser snapshots the page before and
 * after, and animates every element with a `view-transition-name` from its
 * old box to the new one, on the GPU, for ~500 ms. Without support, or with
 * reduced motion, the update just happens.
 */
export function withLayoutTransition(update: () => void): void {
  if (
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update();
    return;
  }
  const root = document.documentElement;
  // Also switches off the sidebar's own CSS width transition, so the "after"
  // snapshot has the final layout instead of the first frame of it.
  root.classList.add(ACTIVE_CLASS);
  running += 1;
  const transition = document.startViewTransition(() => {
    flushSync(update);
  });
  void transition.finished.finally(() => {
    running -= 1;
    if (running === 0) root.classList.remove(ACTIVE_CLASS);
  });
}
