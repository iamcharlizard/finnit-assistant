'use client';

import * as React from 'react';

/** Longest exit animation (150 ms) plus slack, in case none runs at all. */
const EXIT_FALLBACK_MS = 400;

/**
 * For dialogs the parent mounts only while open (`{x ? <MyDialog /> : null}`):
 * unmounting at once would cut the exit animation. `close(then)` closes the
 * dialog and runs `then` (the parent's onClose / onSaved, which unmounts it)
 * once the exit animation ends. Pass `onExitComplete` to the dialog content.
 *
 *   const exit = useDialogExit();
 *   <Dialog open={exit.open} onOpenChange={(o) => !o && exit.close(onClose)}>
 *     <DialogContent onExitComplete={exit.onExitComplete}>…
 *   exit.after(onSaved)(changed, name);
 */
export function useDialogExit() {
  const [open, setOpen] = React.useState(true);
  const pending = React.useRef<(() => void) | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const onExitComplete = React.useCallback(() => {
    clearTimeout(timer.current);
    const then = pending.current;
    pending.current = null;
    then?.();
  }, []);

  const close = React.useCallback(
    (then?: () => void) => {
      // Already closing: keep the first callback.
      if (pending.current) return;
      pending.current = then ?? (() => undefined);
      setOpen(false);
      timer.current = setTimeout(onExitComplete, EXIT_FALLBACK_MS);
    },
    [onExitComplete],
  );

  const after = React.useCallback(
    <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) =>
        close(() => fn(...args)),
    [close],
  );

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return { open, close, after, onExitComplete };
}
