import * as React from 'react';

/** "Notifications changed" (read, all read): the bell's count reloads. */
const listeners = new Set<() => void>();

export function emitNotificationsChanged() {
  listeners.forEach((listener) => listener());
}

export function useOnNotificationsChanged(callback: () => void) {
  const latest = React.useRef(callback);
  latest.current = callback;
  React.useEffect(() => {
    const listener = () => latest.current();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
