import {
  ArrowLeftRight,
  BookOpen,
  Car,
  CircleArrowDown,
  Coffee,
  CreditCard,
  Film,
  Fuel,
  HeartPulse,
  House,
  Landmark,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

import type { IconKey } from './categories';

/**
 * Icons by key. Screens get plain keys from the server (components can't be
 * passed as props across the server/client boundary) and resolve them here.
 */
export const CATEGORY_ICONS: Record<IconKey, LucideIcon> = {
  food: Utensils,
  groceries: ShoppingCart,
  coffee: Coffee,
  transport: Car,
  fuel: Fuel,
  shopping: ShoppingBag,
  bills: Receipt,
  subscriptions: Repeat,
  entertainment: Film,
  health: HeartPulse,
  insurance: ShieldCheck,
  education: BookOpen,
  personal: Sparkles,
  housing: House,
  loan: Landmark,
  card: CreditCard,
  income: CircleArrowDown,
  transfer: ArrowLeftRight,
  other: Tag,
};
