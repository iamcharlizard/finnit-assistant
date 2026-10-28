'use client';

import * as React from 'react';
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';

/*
 * Follows the `.dark` class on <html> (next-themes `attribute="class"` and the
 * Storybook theme toggle) without depending on next-themes. Colors come from
 * the design tokens, so they switch with the class even before this updates.
 */
function subscribeToHtmlClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function useHtmlClassTheme(): 'light' | 'dark' {
  return React.useSyncExternalStore(
    subscribeToHtmlClass,
    () =>
      document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    () => 'light',
  );
}

function Toaster({ theme, toastOptions, style, ...props }: ToasterProps) {
  const classTheme = useHtmlClassTheme();

  return (
    <Sonner
      theme={theme ?? classTheme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-income" />,
        info: <InfoIcon className="size-4 text-violet-ink" />,
        warning: <TriangleAlertIcon className="size-4 text-highlight" />,
        error: <OctagonXIcon className="size-4 text-expense" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--glass-border)',
          '--border-radius': '0.75rem',
          ...style,
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: 'font-sans shadow-lg',
          description: 'text-on-surface-variant!',
          actionButton: 'bg-accent-neon! text-secondary-foreground!',
          cancelButton: 'bg-muted! text-on-background!',
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast, type ToasterProps };
