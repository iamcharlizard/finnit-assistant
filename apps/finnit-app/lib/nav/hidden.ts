import { BUDGETS_PATH } from '@finnit/core/budgets/view';

/**
 * Screens hidden on mobile for now (not worked on yet): out of the menu and
 * of the "Más" sheet. The routes stay, so a notification that opens one
 * still works. Remove an entry to bring the screen back.
 */
export const HIDDEN_ON_MOBILE: ReadonlySet<string> = new Set([
  BUDGETS_PATH,
  '/planning/goals',
  '/planning/simulator',
]);
