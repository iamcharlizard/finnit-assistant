/**
 * Who sees the first-run onboarding (welcome slides + tour): everyone, once
 * per device. The app stores the version the user finished or skipped.
 */

/** Bump it when the tour changes enough to show it again to everyone. */
export const ONBOARDING_VERSION = 'v1';

/**
 * - `show`: open the welcome slides.
 * - `none`: this version was already seen on this device.
 */
export type OnboardingDecision = 'show' | 'none';

export function onboardingDecision({
  stored,
}: {
  /** What the device stored (`ONBOARDING_VERSION` once seen), or null. */
  stored: string | null;
}): OnboardingDecision {
  // An older version stored means a changed tour: show it again.
  return stored === ONBOARDING_VERSION ? 'none' : 'show';
}
