/** Only same-site relative paths are allowed after login (no open redirects). */
export function safeNextPath(next: unknown): string {
  return typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\') &&
    !next.startsWith('/login')
    ? next
    : '/dashboard';
}
