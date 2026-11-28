import { usePathname } from 'expo-router';

import {
  NAV_SECTIONS,
  activeNavHref,
  isBottomNavKey,
  visibleSections,
  type NavEntry,
  type NavSection,
} from '@finnit/core/nav/sections';

import { HIDDEN_ON_MOBILE } from './hidden';

/** The navigation this user sees on mobile, and which entry is active. */
export function useNav() {
  const pathname = usePathname();
  // The admin panel is web-only: the app always shows the regular sections.
  const sections: NavSection[] = visibleSections(false, NAV_SECTIONS)
    .map((section) => ({ ...section, items: section.items.filter((i) => !HIDDEN_ON_MOBILE.has(i.href)) }))
    .filter((section) => section.items.length > 0);
  const entries = sections.flatMap((section) => section.items.map((entry) => ({ entry, section })));
  const activeHref = activeNavHref(
    entries.map((e) => e.entry.href),
    pathname,
  );
  const rest = entries.filter((e) => !isBottomNavKey(e.entry.key));
  return {
    sections,
    entries,
    activeHref,
    /** Everything not in the bottom bar: the "Más" sheet. */
    rest,
    moreActive: rest.some((e) => e.entry.href === activeHref),
  };
}

export type { NavEntry, NavSection };
