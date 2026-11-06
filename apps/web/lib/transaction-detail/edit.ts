import type { PickerOption } from '@/lib/new-entry/options';
import type { SimilarCategory } from './types';

/**
 * The editor's "Sugerida" pill: the category the user's own patterns
 * suggest, only when it isn't the one already picked and the picker
 * offers it (a hidden or other-kind category is left out).
 */
export function shownSuggestion(
  similar: SimilarCategory | null,
  selectedCategoryId: string,
  options: ReadonlyArray<PickerOption>,
): (SimilarCategory & { label: string }) | null {
  if (!similar || similar.categoryId === selectedCategoryId) return null;
  const option = options.find((o) => o.value === similar.categoryId);
  return option ? { ...similar, label: option.label } : null;
}

/**
 * What the own name should become on save: after creating an automatic
 * name, an own name would hide it, so it goes (privacy stays); otherwise
 * what the user typed, or nothing when it didn't change.
 */
export function ownNameUpdate({
  ruleCreated,
  hasOwnAlias,
  changed,
  input,
}: {
  ruleCreated: boolean;
  hasOwnAlias: boolean;
  changed: boolean;
  input: { displayName: string | null; isPrivate: boolean };
}): { displayName: string | null; isPrivate: boolean } | null {
  if (ruleCreated) {
    return hasOwnAlias || changed
      ? { displayName: null, isPrivate: input.isPrivate }
      : null;
  }
  return changed ? input : null;
}
