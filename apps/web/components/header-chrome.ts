'use client';

import * as React from 'react';

import type { TopAppBarProps } from '@finnit/ui/components/navigation/top-app-bar';

/** What every top bar shares (bell, profile menu), provided by the app shell. */
export type HeaderChrome = Pick<
  TopAppBarProps,
  | 'notificationCount'
  | 'onNotificationsClick'
  | 'notificationsLabel'
  | 'profile'
  | 'tools'
>;

export const HeaderChromeContext = React.createContext<HeaderChrome>({});

/** Marks a screen's own header; the shell hides its generic bar when one is rendered. */
export const PAGE_HEADER_CLASS = 'page-header';

/**
 * Names the top bar for view transitions (the sidebar's layout animation).
 * The generic bar and a screen's PageHeader both carry it; only one is ever
 * displayed, so the name stays unique.
 */
export const HEADER_TRANSITION_CLASS = '[view-transition-name:app-header]';
