import {
  ArrowLeftRight,
  CalendarDays,
  Calculator,
  ChartLine,
  ClipboardList,
  CreditCard,
  FileText,
  History,
  House,
  Landmark,
  Mail,
  RefreshCw,
  PiggyBank,
  Repeat,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

import {
  NAV_SECTIONS as SECTION_DATA,
  visibleSections as visibleSectionsOf,
  type NavEntry as NavEntryData,
  type NavItemKey,
  type NavSection as NavSectionData,
  type NavSectionKey,
} from '@finnit/core/nav/sections';

export {
  BOTTOM_NAV_KEYS,
  SETTINGS_HREF,
  activeGroupKey,
  activeNavHref,
  isBottomNavKey,
  isNavGroup,
  type BottomNavKey,
  type NavItemKey,
  type NavSectionKey,
} from '@finnit/core/nav/sections';

/** The web's icons for the shared navigation (@finnit/core/nav/sections). */
const ITEM_ICONS: Record<NavItemKey, LucideIcon> = {
  dashboard: House,
  history: History,
  recurring: Repeat,
  statements: FileText,
  cards: CreditCard,
  calendar: CalendarDays,
  budgets: PiggyBank,
  debts: Landmark,
  goals: Target,
  simulator: Calculator,
  analytics: ChartLine,
  adminUsers: UserCheck,
  waitlist: Mail,
  adminAi: Sparkles,
  adminBanks: RefreshCw,
};

/** Groups' own icons (their submenu button). */
const GROUP_ICONS: Partial<Record<NavSectionKey, LucideIcon>> = {
  transactions: ArrowLeftRight,
  planning: ClipboardList,
  users: Users,
  system: SlidersHorizontal,
};

export interface NavEntry extends NavEntryData {
  icon: LucideIcon;
}

export interface NavSection extends NavSectionData<NavEntry> {
  /** A group's icon (its submenu button); single-screen sections use the screen's. */
  icon?: LucideIcon;
}

export const NAV_SECTIONS: ReadonlyArray<NavSection> = SECTION_DATA.map(
  (section) => ({
    ...section,
    icon: GROUP_ICONS[section.key],
    items: section.items.map((item) => ({
      ...item,
      icon: ITEM_ICONS[item.key],
    })),
  }),
);

/** The sections this user sees: no empty ones, admin only for admins. */
export function visibleSections(
  isAdmin: boolean,
  sections: ReadonlyArray<NavSection> = NAV_SECTIONS,
): NavSection[] {
  return visibleSectionsOf(isAdmin, sections);
}
