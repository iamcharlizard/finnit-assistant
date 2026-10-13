'use client';

import * as React from 'react';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

const SessionContext = React.createContext<SessionUser | null>(null);

/** The signed-in user, resolved on the server by the (app) layout. */
export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <SessionContext value={user}>{children}</SessionContext>;
}

export function useSessionUser(): SessionUser {
  const user = React.use(SessionContext);
  if (!user)
    throw new Error('useSessionUser must be used inside SessionProvider');
  return user;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '');
  return letters.toUpperCase() || '?';
}
