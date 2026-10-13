/**
 * Selection and bulk actions of "Clasificar movimientos". Pure functions
 * over the visible rows; the screen keeps the selected ids in a Set.
 */
export type Selection = ReadonlySet<string>;

interface SelectableRow {
  id: string;
  selectable: boolean;
  categoryId: string | null;
  suggestion: { categoryId: string } | null;
}

/** categorizeTransactions takes up to this many ids per call. */
export const CATEGORIZE_MAX = 500;
/** suggestTransactionCategories takes up to this many ids per call. */
export const SUGGEST_MAX = 100;

export function toggleSelection(
  selection: Selection,
  id: string,
  checked: boolean,
): Set<string> {
  const next = new Set(selection);
  if (checked) next.add(id);
  else next.delete(id);
  return next;
}

export function selectableIds(rows: ReadonlyArray<SelectableRow>): string[] {
  return rows.filter((r) => r.selectable).map((r) => r.id);
}

/** True when every selectable row on screen is selected (and there is one). */
export function isAllSelected(
  rows: ReadonlyArray<SelectableRow>,
  selection: Selection,
): boolean {
  const ids = selectableIds(rows);
  return ids.length > 0 && ids.every((id) => selection.has(id));
}

/** Partly selected: for the "Seleccionar todo" checkbox's mixed state. */
export function isSomeSelected(
  rows: ReadonlyArray<SelectableRow>,
  selection: Selection,
): boolean {
  return selectableIds(rows).some((id) => selection.has(id));
}

/** "Seleccionar todo": selects the visible page, or clears it when all are. */
export function toggleAll(
  rows: ReadonlyArray<SelectableRow>,
  selection: Selection,
): Set<string> {
  const ids = selectableIds(rows);
  const next = new Set(selection);
  if (isAllSelected(rows, selection)) ids.forEach((id) => next.delete(id));
  else ids.forEach((id) => next.add(id));
  return next;
}

/** Drops ids no longer on screen (after a reload or a filter change). */
export function pruneSelection(
  selection: Selection,
  rows: ReadonlyArray<SelectableRow>,
): Set<string> {
  const present = new Set(selectableIds(rows));
  return new Set([...selection].filter((id) => present.has(id)));
}

/** Selected ids in screen order (stable payloads). */
export function selectedIds(
  rows: ReadonlyArray<SelectableRow>,
  selection: Selection,
): string[] {
  return selectableIds(rows).filter((id) => selection.has(id));
}

/**
 * What "Sugerir con IA" sends: the selection, or else every uncategorized
 * row on screen without a suggestion yet; at most SUGGEST_MAX.
 */
export function suggestionTargets(
  rows: ReadonlyArray<SelectableRow>,
  selection: Selection,
  max = SUGGEST_MAX,
): { ids: string[]; truncated: boolean } {
  const chosen =
    selection.size > 0
      ? selectedIds(rows, selection)
      : rows
          .filter((r) => r.selectable && !r.categoryId && !r.suggestion)
          .map((r) => r.id);
  return { ids: chosen.slice(0, max), truncated: chosen.length > max };
}

/**
 * Rows "Aceptar todas" / "Rechazar todas" act on: the selected rows with a
 * suggestion, or every row with one when nothing is selected.
 */
export function reviewTargets(
  rows: ReadonlyArray<SelectableRow>,
  selection: Selection,
): string[] {
  const withSuggestion = rows.filter((r) => r.suggestion);
  const pool =
    selection.size > 0
      ? withSuggestion.filter((r) => selection.has(r.id))
      : withSuggestion;
  return pool.map((r) => r.id);
}

export interface CategorizeBatch {
  ids: string[];
  categoryId: string;
  createRule: boolean;
}

/** categorizeTransactions calls for some ids, CATEGORIZE_MAX at a time. */
export function categorizeBatches(
  ids: ReadonlyArray<string>,
  categoryId: string,
  createRule: boolean,
  max = CATEGORIZE_MAX,
): CategorizeBatch[] {
  const unique = [...new Set(ids)];
  const batches: CategorizeBatch[] = [];
  for (let i = 0; i < unique.length; i += max) {
    batches.push({ ids: unique.slice(i, i + max), categoryId, createRule });
  }
  return batches;
}

/**
 * What came back from "Sugerir con IA": how many rows got a suggestion.
 * None means the AI is off or failed; the screen says so kindly.
 */
export function suggestionOutcome(
  requested: ReadonlyArray<string>,
  returned: ReadonlyArray<{ id: string; suggestedCategory?: unknown }>,
): { suggested: number; unavailable: boolean } {
  const asked = new Set(requested);
  const suggested = returned.filter(
    (tx) => asked.has(tx.id) && tx.suggestedCategory,
  ).length;
  return { suggested, unavailable: requested.length > 0 && suggested === 0 };
}
