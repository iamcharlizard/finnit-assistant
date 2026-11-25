/** Why a bank couldn't be updated, by the provider's code (see USER_ACTION_CODES). */
const REASONS: Record<'es' | 'en', Record<number, string>> = {
  es: {
    401: 'El banco rechazó tus datos de acceso',
    403: 'El banco rechazó el código de seguridad o expiró',
    405: 'El banco bloqueó el acceso; contacta a tu banco',
    406: 'El banco solo permite una sesión a la vez; cierra la otra sesión',
    408: 'El banco pide atención; entra a tu banca en línea',
    409: 'Estos datos de acceso son de otro servicio del mismo banco',
    410: 'El banco pide un código de seguridad',
    411: 'El código de seguridad no se capturó a tiempo',
    413: 'Falló el acceso al banco',
  },
  en: {
    401: 'The bank rejected your login details',
    403: 'The bank rejected the security code or it expired',
    405: 'The bank locked the access; contact your bank',
    406: 'The bank allows one session at a time; log out elsewhere',
    408: 'The bank needs attention; log in to online banking',
    409: 'These login details belong to another service of the same bank',
    410: 'The bank asks for a security code',
    411: 'The security code was not entered in time',
    413: 'The bank login failed',
  },
};

/**
 * The notification after a scheduled bank sync, in the user's language:
 * the bank was updated (and how many new movements came), or it couldn't
 * be and why. One per connection, kept current (see upsertLive).
 */
export function syncNoticeTexts(
  locale: string,
  {
    bank,
    ok,
    created,
    code,
  }: {
    bank: string | null;
    ok: boolean;
    created: number;
    code?: number | null;
  },
): { title: string; message: string } {
  bank ??= locale === 'en' ? 'Your bank' : 'Tu banco';
  const reason = code
    ? REASONS[locale === 'en' ? 'en' : 'es'][code]
    : undefined;
  if (locale === 'en') {
    if (ok) {
      return {
        title: `${bank} updated`,
        message:
          created === 0
            ? 'No new movements since the last update.'
            : created === 1
              ? '1 new movement.'
              : `${created} new movements.`,
      };
    }
    return {
      title: `${bank} couldn't be updated`,
      message: `${reason ?? 'The bank did not answer'}. We'll try again on the next update; if it keeps failing, reconnect the bank.`,
    };
  }
  if (ok) {
    return {
      title: `${bank} se actualizó`,
      message:
        created === 0
          ? 'Sin movimientos nuevos desde la última actualización.'
          : created === 1
            ? '1 movimiento nuevo.'
            : `${created} movimientos nuevos.`,
    };
  }
  return {
    title: `No pudimos actualizar ${bank}`,
    message: `${reason ?? 'El banco no respondió'}. Lo intentaremos en la siguiente actualización; si sigue fallando, vuelve a conectar el banco.`,
  };
}
