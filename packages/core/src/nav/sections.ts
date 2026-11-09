/**
 * The app's navigation by sections (web and mobile; each app adds its
 * icons). Labels are message keys
 * (`nav.sections.<key>`, `nav.items.<key>`); components translate them.
 *
 * A section with one screen shows as that screen's link; one with several
 * is a group (a submenu with its own icon) that opens to show them; empty
 * sections (screens still to come) don't show at all. Settings is not in
 * the menu: it lives in the profile menu (sidebar footer, or the header's
 * avatar on small screens).
 */
export type NavSectionKey =
  | 'home'
  | 'transactions'
  | 'accounts'
  | 'calendar'
  | 'planning'
  | 'analytics'
  | 'admin';

export type NavItemKey =
  | 'dashboard'
  | 'history'
  | 'recurring'
  | 'statements'
  | 'cards'
  | 'calendar'
  | 'budgets'
  | 'debts'
  | 'goals'
  | 'simulator'
  | 'analytics'
  | 'admin';

export interface NavEntry {
  key: NavItemKey;
  href: string;
}

export interface NavSection<E extends NavEntry = NavEntry> {
  key: NavSectionKey;
  items: E[];
  /** Only admins see it. */
  adminOnly?: boolean;
}

export const SETTINGS_HREF = '/settings';

export const NAV_SECTIONS: ReadonlyArray<NavSection> = [
  {
    key: 'home',
    items: [{ key: 'dashboard', href: '/dashboard' }],
  },
  {
    key: 'transactions',
    items: [
      { key: 'history', href: '/history' },
      { key: 'recurring', href: '/recurring' },
      { key: 'statements', href: '/statements' },
    ],
  },
  {
    key: 'accounts',
    items: [{ key: 'cards', href: '/accounts' }],
  },
  {
    key: 'calendar',
    items: [{ key: 'calendar', href: '/calendar' }],
  },
  {
    key: 'planning',
    items: [
      { key: 'budgets', href: '/planning/budgets' },
      { key: 'debts', href: '/planning/debts' },
      { key: 'goals', href: '/planning/goals' },
      { key: 'simulator', href: '/planning/simulator' },
    ],
  },
  {
    key: 'analytics',
    items: [{ key: 'analytics', href: '/analytics' }],
  },
  {
    key: 'admin',
    adminOnly: true,
    items: [{ key: 'admin', href: '/admin' }],
  },
];

/** Whether a section shows as a group (a submenu) rather than one link. */
export function isNavGroup(section: Pick<NavSection, 'items'>): boolean {
  return section.items.length > 1;
}

/** The group that holds the current page, if any. */
export function activeGroupKey(
  sections: ReadonlyArray<Pick<NavSection, 'key' | 'items'>>,
  activeHref: string | null,
): NavSectionKey | null {
  if (!activeHref) return null;
  return (
    sections.find(
      (s) => isNavGroup(s) && s.items.some((i) => i.href === activeHref),
    )?.key ?? null
  );
}

/** The sections this user sees: no empty ones, admin only for admins. */
export function visibleSections<S extends NavSection<NavEntry>>(
  isAdmin: boolean,
  sections: ReadonlyArray<S>,
): S[] {
  return sections.filter(
    (s) => s.items.length > 0 && (isAdmin || !s.adminOnly),
  );
}

/**
 * Mobile bottom bar: these screens (two before the "+" button, one after),
 * then "Más", a sheet with every other section. Short labels are
 * `nav.short.<key>`.
 */
export const BOTTOM_NAV_KEYS = [
  'dashboard',
  'history',
  'cards',
] as const satisfies ReadonlyArray<NavItemKey>;
export type BottomNavKey = (typeof BOTTOM_NAV_KEYS)[number];

export function isBottomNavKey(key: NavItemKey): key is BottomNavKey {
  return (BOTTOM_NAV_KEYS as ReadonlyArray<NavItemKey>).includes(key);
}

/** The entry the current path belongs to, also for sub-pages (/settings/banks → /settings). */
export function activeNavHref(
  hrefs: ReadonlyArray<string>,
  pathname: string,
): string | null {
  // Longest match first, so /settings/banks would beat /settings if both existed.
  return (
    [...hrefs]
      .sort((a, b) => b.length - a.length)
      .find((href) => pathname === href || pathname.startsWith(`${href}/`)) ??
    null
  );
}
