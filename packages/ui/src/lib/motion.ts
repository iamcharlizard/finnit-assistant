import type * as React from 'react';

/**
 * Enter/exit animations of modal surfaces (tw-animate-css keyframes; Radix
 * waits for the exit animation before unmounting). Opening rises and grows
 * in a little; closing is quicker and drops back. With reduced motion only
 * the fade is left.
 */
export const OVERLAY_MOTION = [
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200 data-[state=open]:ease-out',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150 data-[state=closed]:ease-in',
].join(' ');

export const MODAL_MOTION = [
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-4 data-[state=open]:duration-200 data-[state=open]:ease-out',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2 data-[state=closed]:duration-150 data-[state=closed]:ease-in',
  'motion-reduce:data-[state=open]:[--tw-enter-scale:1] motion-reduce:data-[state=open]:[--tw-enter-translate-y:0]',
  'motion-reduce:data-[state=closed]:[--tw-exit-scale:1] motion-reduce:data-[state=closed]:[--tw-exit-translate-y:0]',
].join(' ');

/**
 * Calls `onExitComplete` when the content's own exit animation ends (not a
 * child's), keeping any `onAnimationEnd` the caller passed.
 */
export function exitHandler(
  onExitComplete: (() => void) | undefined,
  onAnimationEnd: React.AnimationEventHandler<HTMLDivElement> | undefined,
): React.AnimationEventHandler<HTMLDivElement> {
  return (event) => {
    onAnimationEnd?.(event);
    if (
      onExitComplete &&
      event.target === event.currentTarget &&
      event.currentTarget.dataset.state === 'closed'
    ) {
      onExitComplete();
    }
  };
}
