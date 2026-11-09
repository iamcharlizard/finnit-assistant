import * as React from 'react';

/**
 * "The privacy PIN was entered": the unlock is a sheet route, so whoever
 * opened it (e.g. showing hidden amounts) hears about it here.
 */
const listeners = new Set<() => void>();

export function emitPrivacyUnlocked() {
  listeners.forEach((listener) => listener());
}

export function useOnPrivacyUnlocked(callback: () => void) {
  const onUnlocked = React.useEffectEvent(callback);
  React.useEffect(() => {
    const listener = () => onUnlocked();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
