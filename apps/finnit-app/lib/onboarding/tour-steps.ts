import type { Translate } from '@finnit/core/i18n/translator';
import type { TourStep } from '@finnit/ui-native/components/tour/tour-context';

/**
 * The app tour, in order. `target` is a `TourTarget` id: the bottom bar's
 * are `nav-<key>`, `nav-add` and `nav-more`; `balance` is on Inicio,
 * `calendar` on the calendar screen, `profile` the header's avatar.
 */
const STEPS = [
  { id: 'balance', target: 'balance', route: '/dashboard' },
  { id: 'add', target: 'nav-add' },
  { id: 'history', target: 'nav-history' },
  { id: 'cards', target: 'nav-cards' },
  { id: 'more', target: 'nav-more' },
  { id: 'calendar', target: 'calendar', route: '/calendar' },
  { id: 'profile', target: 'profile' },
] as const;

export function tourSteps(t: Translate): TourStep[] {
  return STEPS.map((step) => ({
    ...step,
    title: t(`onboarding.tour.${step.id}.title`),
    body: t(`onboarding.tour.${step.id}.body`),
  }));
}
