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
} from 'lucide-react-native';

import type { NavItemKey, NavSectionKey } from '@finnit/core/nav/sections';

/** The same icons as the web's navigation (lucide). */
export const NAV_ITEM_ICONS: Record<NavItemKey, LucideIcon> = {
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

export const NAV_GROUP_ICONS: Partial<Record<NavSectionKey, LucideIcon>> = {
  transactions: ArrowLeftRight,
  planning: ClipboardList,
  users: Users,
  system: SlidersHorizontal,
};
