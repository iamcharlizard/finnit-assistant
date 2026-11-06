/** "Clasificar automáticamente": how, and what came of it. */
export type AutoCategorizeMode = 'history' | 'ai' | 'both';

export const AUTO_CATEGORIZE_MODES: ReadonlyArray<AutoCategorizeMode> = [
  'history',
  'ai',
  'both',
];

export interface AutoCategorizeResult {
  categorized: number;
  suggested: number;
  remaining: number;
}

export const AUTO_CATEGORIZE_MUTATION = `mutation AutoCategorizeTransactions($mode: AutoCategorizeMode) { autoCategorizeTransactions(mode: $mode) { categorized suggested remaining } }`;

/** Which toast to show after a run (message keys under `categorize.auto.results`). */
export function autoCategorizeOutcome(
  mode: AutoCategorizeMode,
  result: AutoCategorizeResult,
): 'categorizedAndSuggested' | 'categorized' | 'suggested' | 'nothing' {
  const usedAi = mode !== 'history';
  if (result.categorized > 0 && usedAi && result.suggested > 0) {
    return 'categorizedAndSuggested';
  }
  if (result.categorized > 0) return 'categorized';
  if (result.suggested > 0) return 'suggested';
  return 'nothing';
}
