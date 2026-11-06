/** Rules of the privacy PIN (pure, so they are easy to test). */

export const PRIVACY_PIN_MIN = 4;
export const PRIVACY_PIN_MAX = 8;
/** Wrong PINs in a row before a pause. */
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;
/** How long an unlock lasts. */
export const UNLOCK_MINUTES = 10;
/** How long a reset link works. */
export const RESET_LINK_MINUTES = 30;
/** Request header with the unlock token (the web adds it from its cookie). */
export const PRIVACY_UNLOCK_HEADER = 'x-privacy-unlock';

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PRIVACY_PIN_MIN},${PRIVACY_PIN_MAX}}$`).test(pin);
}

/** After a wrong PIN: the new count, and until when attempts pause (if they do). */
export function afterWrongPin(
  failedAttempts: number,
  now: Date,
): { failedAttempts: number; lockedUntil: Date | null } {
  const next = failedAttempts + 1;
  if (next < MAX_PIN_ATTEMPTS)
    return { failedAttempts: next, lockedUntil: null };
  return {
    failedAttempts: 0,
    lockedUntil: new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000),
  };
}

/** The reset email, in the user's language. */
export function resetEmail(
  locale: string,
  name: string,
  link: string,
): { subject: string; text: string } {
  if (locale === 'en') {
    return {
      subject: 'Reset your Finnit privacy PIN',
      text: `Hi ${name},\n\nUse this link within ${RESET_LINK_MINUTES} minutes to choose a new privacy PIN:\n${link}\n\nIf you didn't ask for it, ignore this email; your PIN stays the same.`,
    };
  }
  return {
    subject: 'Restablece tu PIN de privacidad de Finnit',
    text: `Hola ${name},\n\nUsa este enlace en los próximos ${RESET_LINK_MINUTES} minutos para elegir un PIN de privacidad nuevo:\n${link}\n\nSi no lo pediste, ignora este correo; tu PIN no cambia.`,
  };
}
