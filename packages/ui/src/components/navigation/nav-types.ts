import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Router-agnostic link: pass Next's `Link` (or any component accepting
 * href/className/children) so the nav works in Next.js and Storybook alike.
 */
export type LinkComponent = React.ElementType<{
  href: string;
  className?: string;
  children?: React.ReactNode;
  'aria-current'?: 'page' | undefined;
  'aria-label'?: string;
}>;
