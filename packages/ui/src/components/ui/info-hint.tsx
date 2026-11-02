'use client';

import * as React from 'react';
import { InfoIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

interface InfoHintProps {
  /** Accessible name of the icon button, e.g. "More about the payoff". */
  label: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * An info icon whose help text opens on hover (pointer) and on click or tap
 * (touch and keyboard), so it also works where hover doesn't exist.
 */
function InfoHint({ label, children, side = 'top', className }: InfoHintProps) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  // A short delay lets the pointer move from the icon onto the text.
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };
  React.useEffect(() => cancelClose, []);

  const hover = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    cancelClose();
    setOpen(true);
  };
  const leave = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse') closeSoon();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          data-slot="info-hint"
          onPointerEnter={hover}
          onPointerLeave={leave}
          className={cn(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none hover:text-on-background focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:text-on-background',
            className,
          )}
        >
          <InfoIcon aria-hidden className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        onPointerEnter={hover}
        onPointerLeave={leave}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-72 p-3 text-xs leading-relaxed text-on-surface-variant"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

export { InfoHint, type InfoHintProps };
