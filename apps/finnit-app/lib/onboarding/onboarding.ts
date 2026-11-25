import * as React from 'react';

import {
  ONBOARDING_VERSION,
  onboardingDecision,
} from '@finnit/core/onboarding/eligibility';

import { readItem, writeItem } from '@/lib/session/storage';

/** The welcome slides were left (finished or skipped): don't show them again here. */
export function markOnboardingSeen(): Promise<void> {
  return writeItem('onboarding', ONBOARDING_VERSION);
}

/**
 * Dev only: `EXPO_PUBLIC_RESET_ONBOARDING=1` (`pnpm ios:onboarding` /
 * `pnpm start:onboarding`) forgets on every launch that the welcome was
 * seen, so it shows again. Once per launch, so
 * finishing it doesn't bring it back until the next one.
 */
let resetOnLaunch = __DEV__ && process.env.EXPO_PUBLIC_RESET_ONBOARDING === '1';

/** What to do on this device (see `onboardingDecision`). */
export function decideOnboarding() {
  if (resetOnLaunch) {
    resetOnLaunch = false;
    void writeItem('onboarding', null);
    return 'show' as const;
  }
  return onboardingDecision({ stored: readItem('onboarding') });
}

/*
 * "Ver el recorrido" from the welcome slides (a modal over the tabs): the
 * tour lives in the tabs layout, so the request goes through here.
 */
const tourListeners = new Set<() => void>();
let pendingTour = false;

export function requestTour() {
  if (tourListeners.size === 0) pendingTour = true;
  tourListeners.forEach((listener) => listener());
}

export function useOnTourRequest(callback: () => void) {
  const latest = React.useRef(callback);
  React.useEffect(() => {
    latest.current = callback;
  });
  React.useEffect(() => {
    const listener = () => latest.current();
    tourListeners.add(listener);
    if (pendingTour) {
      pendingTour = false;
      listener();
    }
    return () => {
      tourListeners.delete(listener);
    };
  }, []);
}
