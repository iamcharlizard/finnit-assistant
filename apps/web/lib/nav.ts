import {
  CalendarDays,
  ChartLine,
  CreditCard,
  History,
  House,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import type { NavItem } from '@finnit/ui/components/navigation/nav-types';

/** Desktop sidebar: every screen. */
export const SIDE_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Inicio', icon: House },
  { href: '/history', label: 'Historial', icon: History },
  { href: '/analytics', label: 'Analytics', icon: ChartLine },
  { href: '/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/cards', label: 'Tarjetas', icon: CreditCard },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

/** Only for admins: desktop sidebar (on narrow screens, from Settings). */
export const ADMIN_NAV_ITEM: NavItem = {
  href: '/admin',
  label: 'Administración',
  icon: ShieldCheck,
};

/** Mobile bottom bar: same four tabs as the native app. */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/analytics', label: 'Analytics', icon: ChartLine },
  { href: '/cards', label: 'Cards', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Finnit',
  '/history': 'Historial',
  '/analytics': 'Finnit Analytics',
  '/calendar': 'Calendario',
  '/cards': 'Tarjetas',
  '/settings': 'Configuración',
  '/settings/banks': 'Bancos conectados',
  '/settings/banks/connect': 'Conectar banco',
  '/admin/users': 'Administración',
  '/admin/ai': 'Administración',
};

/** The nav item for a path, also for its sub-pages (/settings/banks → /settings). */
export function activeNavHref(
  items: ReadonlyArray<NavItem>,
  pathname: string,
): string {
  return (
    items.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.href ?? pathname
  );
}
