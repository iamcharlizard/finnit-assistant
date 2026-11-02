'use client';

import * as React from 'react';

import type { TopAppBarProps } from '@finnit/ui/components/navigation/top-app-bar';

/** What every top bar shares (bell, avatar), provided by the app shell. */
export type HeaderChrome = Pick<
  TopAppBarProps,
  | 'notificationCount'
  | 'onNotificationsClick'
  | 'avatarFallback'
  | 'notificationsLabel'
  | 'profileLabel'
  | 'tools'
>;

export const HeaderChromeContext = React.createContext<HeaderChrome>({});

/** Marks a screen's own header; the shell hides its generic bar when one is rendered. */
export const PAGE_HEADER_CLASS = 'page-header';
