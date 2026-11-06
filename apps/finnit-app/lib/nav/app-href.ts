import type { Href } from 'expo-router';

import { hrefParam } from './href';

/**
 * A web route from @finnit/core (notifications, facts, links) as the
 * mobile app's route: same paths except where the app shows a screen of
 * its own (an account, a movement, bank connection).
 */
export function appHref(href: string): Href {
  const [path = ''] = href.split('?');
  if (path === '/accounts') {
    const account = hrefParam(href, 'account');
    if (account) return { pathname: '/accounts/[accountId]', params: { accountId: account } };
  }
  const movement = /^\/transactions\/([\w-]+)$/.exec(path);
  if (movement && movement[1] !== 'categorize') return { pathname: '/transaction/[id]', params: { id: movement[1]! } };
  if (path === '/settings/banks/connect') return '/connect-bank';
  return href as Href;
}
