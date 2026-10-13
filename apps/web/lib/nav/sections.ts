import {
  ChartLine,
  CreditCard,
  History,
  House,
  Repeat,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/**
 * The app's navigation by sections. Labels are message keys
 * (`nav.sections.<key>`, `nav.items.<key>`); components translate them.
 *
 * A section with one screen shows as that screen's link; one with several
 * shows its name above them; empty sections (screens still to come) don't
 * show at all.
 */
export type NavSectionKey =
  | 'home'
  | 'transactions'
  | 'recurring'
  | 'accounts'
  | 'planning'
  | 'analytics'
  | 'statements'
  | 'settings'
  | 'admin';

export type NavItemKey =
  | 'dashboard'
  | 'history'
  | 'recurring'
  | 'cards'
  | 'analytics'
  | 'settings'
  | 'admin';

export interface NavEntry {
  key: NavItemKey;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  key: NavSectionKey;
  items: NavEntry[];
  /** Only admins see it. */
  adminOnly?: boolean;
}

export const NAV_SECTIONS: ReadonlyArray<NavSection> = [
  {
    key: 'home',
    items: [{ key: 'dashboard', href: '/dashboard', icon: House }],
  },
  {
    // Later: /transactions/categorize.
    key: 'transactions',
    items: [{ key: 'history', href: '/history', icon: History }],
  },
  {
    // /recurring replaces the calendar once that screen exists.
    key: 'recurring',
    items: [{ key: 'recurring', href: '/calendar', icon: Repeat }],
  },
  {
    key: 'accounts',
    items: [{ key: 'cards', href: '/cards', icon: CreditCard }],
  },
  // Budgets, goals and debts arrive in later phases.
  { key: 'planning', items: [] },
  {
    key: 'analytics',
    items: [{ key: 'analytics', href: '/analytics', icon: ChartLine }],
  },
  // Statement imports get their own screen later.
  { key: 'statements', items: [] },
  {
    key: 'settings',
    items: [{ key: 'settings', href: '/settings', icon: Settings }],
  },
  {
    key: 'admin',
    adminOnly: true,
    items: [{ key: 'admin', href: '/admin', icon: ShieldCheck }],
  },
];

/** The sections this user sees: no empty ones, admin only for admins. */
export function visibleSections(
  isAdmin: boolean,
  sections: ReadonlyArray<NavSection> = NAV_SECTIONS,
): NavSection[] {
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
