'use client';

/*
 * The right-click (long-press on touch) menu of an area: shadcn's context
 * menu on Radix, with the same look as DropdownMenu.
 */

import * as React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';

import { cn } from '../../lib/utils';

function ContextMenu(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Root>,
) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>,
) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  );
}

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-xl border border-glass-border bg-popover p-1 text-popover-foreground shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

/** An action; `variant="destructive"` paints it red (e.g. "Eliminar"). */
function ContextMenuItem({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  variant?: 'default' | 'destructive';
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-variant={variant}
      className={cn(
        "relative flex min-h-10 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-on-surface-variant",
        'data-[variant=destructive]:text-expense data-[variant=destructive]:[&_svg]:text-expense',
        className,
      )}
      {...props}
    />
  );
}

/** A keyboard hint at the item's end (e.g. "⌘⌫"). */
function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        'ml-auto text-xs tracking-widest text-on-surface-variant',
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label>) {
  return (
    <ContextMenuPrimitive.Label
      data-slot="context-menu-label"
      className={cn(
        'px-3 py-1.5 text-label-sm font-medium uppercase tracking-widest text-on-surface-variant',
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn('-mx-1 my-1 h-px bg-outline', className)}
      {...props}
    />
  );
}

function ContextMenuGroup(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Group>,
) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  );
}

function ContextMenuRadioGroup(
  props: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>,
) {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  );
}

/** An option of a radio group: a check marks the chosen one. */
function ContextMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(
        "relative flex min-h-10 cursor-default select-none items-center gap-2 rounded-lg py-2 pr-9 pl-3 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=checked]:font-medium [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-on-surface-variant",
        className,
      )}
      {...props}
    >
      {children}
      <span className="absolute right-3 flex size-4 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <Check className="size-4 text-brand-ink!" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
    </ContextMenuPrimitive.RadioItem>
  );
}

/**
 * A checkable item (several can be on). A box on the left shows its state;
 * the menu stays open while choosing unless `onSelect` says otherwise.
 */
function ContextMenuCheckboxItem({
  className,
  children,
  onSelect,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      // Keep the menu open: filters usually take more than one choice.
      onSelect={onSelect ?? ((event) => event.preventDefault())}
      className={cn(
        "group/check relative flex min-h-10 cursor-default select-none items-center gap-2.5 rounded-lg py-2 pr-3 pl-3 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-on-surface-variant",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-input group-data-[state=checked]/check:border-accent-neon group-data-[state=checked]/check:bg-accent-neon"
      >
        <ContextMenuPrimitive.ItemIndicator>
          <Check
            className="size-3 text-secondary-foreground!"
            strokeWidth={3}
          />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuSub(
  props: React.ComponentProps<typeof ContextMenuPrimitive.Sub>,
) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}

function ContextMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger>) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      className={cn(
        "flex min-h-10 cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-on-surface-variant",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.SubContent
        data-slot="context-menu-sub-content"
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-xl border border-glass-border bg-popover p-1 text-popover-foreground shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuGroup,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
};
