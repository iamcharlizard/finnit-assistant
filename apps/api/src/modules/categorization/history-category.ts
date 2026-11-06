import { TransactionType } from '@finnit/database';

/** Learning from past categorizations needs this share for the winner… */
export const HISTORY_MIN_SHARE = 0.6;
/** …and this many movements, when the merchant has had other categories. */
export const HISTORY_MIN_COUNT = 2;

/** A categorized movement seen as merchant key → category. */
export interface CategorizedSample {
  /** `ruleKey` of its text. */
  key: string;
  type: TransactionType;
  categoryId: string;
}

/** Counts by "type:key" → category → movements. */
export type HistoryIndex = Map<string, Map<string, number>>;

const indexKey = (type: TransactionType, key: string) => `${type}:${key}`;

export function buildHistoryIndex(samples: CategorizedSample[]): HistoryIndex {
  const index: HistoryIndex = new Map();
  for (const sample of samples) {
    const id = indexKey(sample.type, sample.key);
    const counts = index.get(id) ?? new Map<string, number>();
    counts.set(sample.categoryId, (counts.get(sample.categoryId) ?? 0) + 1);
    index.set(id, counts);
  }
  return index;
}

/**
 * The category the user has given this merchant before (same type):
 * the only one ever used, or the clear favourite (at least 2 movements and
 * 60 %). Null when there is no history or no clear answer (a tie).
 */
export function categoryFromHistory(
  index: HistoryIndex,
  type: TransactionType,
  key: string | null,
): string | null {
  if (!key) return null;
  const counts = index.get(indexKey(type, key));
  if (!counts || counts.size === 0) return null;
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [best, bestCount] = ranked[0];
  if (ranked.length === 1) return best;
  if (ranked[1][1] === bestCount) return null;
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  return bestCount >= HISTORY_MIN_COUNT &&
    bestCount / total >= HISTORY_MIN_SHARE
    ? best
    : null;
}
