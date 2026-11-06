/** The privacy PIN: 4 to 8 digits. */
export const PIN_MIN = 4;
export const PIN_MAX = 8;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);
}

/** Only digits, at most PIN_MAX (what a PIN field keeps of what was typed). */
export function pinInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, PIN_MAX);
}

/** The API refused because the privacy PIN must be entered first. */
export function isPrivacyLocked(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'PRIVACY_LOCKED';
}

export const PRIVACY_STATUS_FIELDS = 'hasPin unlocked';
