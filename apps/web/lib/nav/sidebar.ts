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
