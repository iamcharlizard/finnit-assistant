'use client';

import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { XIcon } from 'lucide-react';

import { exitHandler, MODAL_MOTION, OVERLAY_MOTION } from '../../lib/motion';
import { cn } from '../../lib/utils';

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(
  props: React.ComponentProps<typeof DialogPrimitive.Close>,
) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel = 'Close',
  onExitComplete,
  onAnimationEnd,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /** Accessible name of the close button (pass the translated text). */
  closeLabel?: string;
  /** After the exit animation (see useDialogExit). */
  onExitComplete?: () => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className={cn('fixed inset-0 z-50 bg-black/50', OVERLAY_MOTION)}
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[min(92dvh,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-card border border-glass-border bg-popover p-6 text-popover-foreground shadow-lg outline-none',
          // With a DialogBody only the body scrolls; header and footer stay put.
          'has-[[data-slot=dialog-body]]:overflow-hidden',
          // A form wrapping header, body and footer must shrink with the dialog.
          '[&>form]:min-h-0 [&>form]:flex-1',
          MODAL_MOTION,
          className,
        )}
        onAnimationEnd={exitHandler(onExitComplete, onAnimationEnd)}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <XIcon aria-hidden className="size-5" />
            <span className="sr-only">{closeLabel}</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5 pr-10', className)}
      {...props}
    />
  );
}

/**
 * The dialog's scrollable part, between DialogHeader and DialogFooter (which
 * stay visible). It bleeds into the dialog's padding so focus rings and
 * scrollbars aren't clipped.
 */
function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        '-mx-6 -my-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-6 py-1',
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-title-lg font-bold text-on-background', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-on-surface-variant', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
