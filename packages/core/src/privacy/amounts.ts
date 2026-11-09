/**
 * "Ocultar montos": the choice is kept per device (web: cookies the server
 * reads, so the first render is already hidden; mobile: secure storage).
 */
export const HIDE_AMOUNTS_COOKIE = 'finnit-hide-amounts';
/** "No volver a preguntar" on the suggestion to create a PIN. */
export const PIN_SUGGESTION_COOKIE = 'finnit-pin-suggestion';

export function parseHideAmounts(value: string | null | undefined): boolean {
  return value === '1';
}

export function parsePinSuggestionDismissed(
  value: string | null | undefined,
): boolean {
  return value === 'off';
}

export interface PrivacyStatus {
  hasPin: boolean;
  unlocked: boolean;
}

/** Showing hidden amounts needs the PIN when there is one and it's locked. */
export function needsPinToShow(privacy: PrivacyStatus | null | undefined) {
  return Boolean(privacy?.hasPin && !privacy.unlocked);
}

/** Hiding without a PIN suggests creating one (unless the user said not to). */
export function shouldSuggestPin(
  privacy: PrivacyStatus | null | undefined,
  dismissed: boolean,
): boolean {
  return !privacy?.hasPin && !dismissed;
}
