import {
  Calculator,
  ChartLine,
  CreditCard,
  FileText,
  History,
  House,
  Landmark,
  PiggyBank,
  Repeat,
  Settings,
  ShieldCheck,
  Tags,
  Target,
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
  | 'categorize'
  | 'recurring'
  | 'cards'
  | 'budgets'
  | 'debts'
  | 'goals'
  | 'simulator'
  | 'analytics'
  | 'statements'
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
    key: 'transactions',
    items: [
      { key: 'history', href: '/history', icon: History },
      { key: 'categorize', href: '/transactions/categorize', icon: Tags },
    ],
  },
  {
    key: 'recurring',
    items: [{ key: 'recurring', href: '/recurring', icon: Repeat }],
  },
  {
    key: 'accounts',
    items: [{ key: 'cards', href: '/accounts', icon: CreditCard }],
  },
  {
    key: 'planning',
    items: [
      { key: 'budgets', href: '/planning/budgets', icon: PiggyBank },
      { key: 'debts', href: '/planning/debts', icon: Landmark },
      { key: 'goals', href: '/planning/goals', icon: Target },
      { key: 'simulator', href: '/planning/simulator', icon: Calculator },
    ],
  },
  {
    key: 'analytics',
    items: [{ key: 'analytics', href: '/analytics', icon: ChartLine }],
  },
  {
    key: 'statements',
    items: [{ key: 'statements', href: '/statements', icon: FileText }],
  },
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
