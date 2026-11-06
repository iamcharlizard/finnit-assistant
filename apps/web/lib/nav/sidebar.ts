/** The desktop sidebar's state, kept in a cookie so the server renders it. */
export const SIDEBAR_COOKIE = 'finnit-sidebar';

export type SidebarState = 'expanded' | 'collapsed';

/** Collapsed only when the cookie says so; expanded by default. */
export function parseSidebarCollapsed(
  value: string | null | undefined,
): boolean {
  return value === 'collapsed';
}

export function sidebarCookieValue(collapsed: boolean): SidebarState {
  return collapsed ? 'collapsed' : 'expanded';
}

/** The sidebar groups the user left open, dot-separated (cookie values can't hold commas). */
export const NAV_GROUPS_COOKIE = 'finnit-nav-groups';

const GROUP_KEY = /^[a-z]{1,20}$/;

export function parseOpenGroups(value: string | null | undefined): string[] {
  return (value ?? '')
    .split('.')
    .map((key) => key.trim())
    .filter((key) => GROUP_KEY.test(key))
    .slice(0, 10);
}

export function openGroupsCookieValue(keys: Iterable<string>): string {
  return [...new Set(keys)].filter((key) => GROUP_KEY.test(key)).join('.');
}
