import {
  ArrowLeftRight,
  Calculator,
  ChartLine,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  House,
  Landmark,
  PiggyBank,
  Repeat,
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
 * is a group (a submenu with its own icon) that opens to show them; empty
 * sections (screens still to come) don't show at all. Settings is not in
 * the menu: it lives in the profile menu (sidebar footer, or the header's
 * avatar on small screens).
 */
export type NavSectionKey =
  | 'home'
  | 'transactions'
  | 'accounts'
  | 'planning'
  | 'analytics'
  | 'admin';

export type NavItemKey =
  | 'dashboard'
  | 'history'
  | 'categorize'
  | 'recurring'
  | 'statements'
  | 'cards'
  | 'budgets'
  | 'debts'
  | 'goals'
  | 'simulator'
  | 'analytics'
  | 'admin';

export interface NavEntry {
  key: NavItemKey;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  key: NavSectionKey;
  items: NavEntry[];
  /** A group's icon (its submenu button); single-screen sections use the screen's. */
  icon?: LucideIcon;
  /** Only admins see it. */
  adminOnly?: boolean;
}

export const SETTINGS_HREF = '/settings';

export const NAV_SECTIONS: ReadonlyArray<NavSection> = [
  {
    key: 'home',
    items: [{ key: 'dashboard', href: '/dashboard', icon: House }],
  },
  {
    key: 'transactions',
    icon: ArrowLeftRight,
    items: [
      { key: 'history', href: '/history', icon: History },
      { key: 'categorize', href: '/transactions/categorize', icon: Tags },
      { key: 'recurring', href: '/recurring', icon: Repeat },
      { key: 'statements', href: '/statements', icon: FileText },
    ],
  },
  {
    key: 'accounts',
    items: [{ key: 'cards', href: '/accounts', icon: CreditCard }],
  },
  {
    key: 'planning',
    icon: ClipboardList,
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
    key: 'admin',
    adminOnly: true,
    items: [{ key: 'admin', href: '/admin', icon: ShieldCheck }],
  },
];

/** Whether a section shows as a group (a submenu) rather than one link. */
export function isNavGroup(section: NavSection): boolean {
  return section.items.length > 1;
}

/** The group that holds the current page, if any. */
export function activeGroupKey(
  sections: ReadonlyArray<NavSection>,
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
