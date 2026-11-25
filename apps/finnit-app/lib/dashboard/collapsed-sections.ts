import * as React from 'react';

import { readItem, writeItem } from '@/lib/session/storage';

/** The home's foldable sections. */
export type HomeSection = 'accounts' | 'upcoming' | 'debts';

function readCollapsed(): Set<string> {
  return new Set(
    (readItem('collapsedSections') ?? '').split(',').filter(Boolean),
  );
}

/**
 * Whether a home section is folded, remembered on this device: it opens
 * the next time as the user left it.
 */
export function useCollapsedSection(
  section: HomeSection,
): [boolean, () => void] {
  const [collapsed, setCollapsed] = React.useState(() =>
    readCollapsed().has(section),
  );
  const toggle = React.useCallback(() => {
    const next = !collapsed;
    const all = readCollapsed();
    if (next) all.add(section);
    else all.delete(section);
    void writeItem('collapsedSections', [...all].join(',') || null);
    setCollapsed(next);
  }, [collapsed, section]);
  return [collapsed, toggle];
}
