import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';
import { ACCESS_COOKIE } from '@/lib/auth/cookies';
import { TIME_ZONE } from '@finnit/core/finance/dates';
import { LOCALE_COOKIE, resolveLocale } from '@finnit/core/i18n/locales';
import { loadMessages } from '@finnit/core/i18n/messages';

/**
 * next-intl without locale-prefixed URLs: each request picks its language
 * from the signed-in user's preference, the NEXT_LOCALE cookie or (signed
 * out) the browser's Accept-Language; Spanish otherwise.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const signedIn = Boolean(store.get(ACCESS_COOKIE)?.value);
  // Same request-cached call the (app) layout makes: no extra API round trip.
  const user = signedIn ? await getCurrentUser() : null;
  const locale = resolveLocale({
    userLocale: user?.locale,
    cookieLocale: store.get(LOCALE_COOKIE)?.value,
    acceptLanguage: (await headers()).get('accept-language'),
    signedIn: Boolean(user),
  });

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: TIME_ZONE,
  };
});
