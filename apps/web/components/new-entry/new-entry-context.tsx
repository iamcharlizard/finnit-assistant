'use client';

import * as React from 'react';

import type { NewEntryAction, NewEntryPrefill } from './new-entry-flow';

type OpenNewEntry = (
  action?: NewEntryAction,
  prefill?: NewEntryPrefill,
) => void;

const NewEntryContext = React.createContext<OpenNewEntry | null>(null);

/** The app shell's "Nuevo movimiento" sheet, for screens to open it. */
export const NewEntryProvider = NewEntryContext.Provider;

/**
 * Opens "Nuevo movimiento" on a form, optionally filled in (e.g. "Pagar
 * tarjeta" opens a transfer to the card with what is left to pay).
 */
export function useNewEntry(): OpenNewEntry {
  const open = React.useContext(NewEntryContext);
  if (!open) throw new Error('useNewEntry needs the app shell');
  return open;
}
