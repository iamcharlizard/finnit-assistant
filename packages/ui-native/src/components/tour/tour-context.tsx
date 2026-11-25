import * as React from 'react';
import type { HostInstance } from 'react-native';

/** One stop of the guided tour. */
export interface TourStep {
  id: string;
  /** The `TourTarget` id to highlight; none: the card alone, centered. */
  target?: string;
  /** Screen to open first (the app maps it to its router). */
  route?: string;
  title: string;
  body: string;
}

export interface TourLabels {
  next: string;
  back: string;
  done: string;
  skip: string;
  /** "2 de 6" */
  stepOf: (current: number, total: number) => string;
  /** For screen readers: the overlay's close action. */
  close: string;
}

export type TourEndReason = 'done' | 'skipped';

export interface TourControls {
  /** Whether the tour is showing. */
  active: boolean;
  start: () => void;
  stop: (reason?: TourEndReason) => void;
}

/** Where targets register themselves (stable: it never changes, so targets don't re-render). */
export interface TourRegistry {
  register: (
    id: string,
    ref: React.RefObject<HostInstance | null>,
  ) => () => void;
  /** A target moved or resized: measure it again if it's the one shown. */
  relayout: (id: string) => void;
}

export const TourRegistryContext = React.createContext<TourRegistry | null>(
  null,
);
export const TourControlsContext = React.createContext<TourControls | null>(
  null,
);

/** Start or stop the tour from anywhere under `TourProvider` (null outside it). */
export function useTour(): TourControls | null {
  return React.useContext(TourControlsContext);
}
