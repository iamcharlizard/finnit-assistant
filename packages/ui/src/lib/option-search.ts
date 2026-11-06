/**
 * Search for pickers (Combobox): ranks options by how well their label
 * matches what was typed, ignoring case and accents. No fuzzy matching:
 * every typed word must start a word of the label or appear in it, or
 * start a word of the option's group / keywords (e.g. the parent category). Best first:
 * the label is the text, starts with it, has a word starting with it,
 * contains it; options that only match through their group come last.
 */

export interface SearchableOption {
  label: string;
  group?: string;
  keywords?: string[];
}

/** Lowercase, no accents, single spaces, trimmed. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (text: string) => text.split(/[\s/,.()·-]+/).filter(Boolean);

/** How well one option matches `query` (already normalized); 0: no match. */
export function optionScore(option: SearchableOption, query: string): number {
  if (!query) return 1;
  const label = normalizeSearch(option.label);
  const labelWords = words(label);
  const extraWords = [option.group ?? '', ...(option.keywords ?? [])]
    .map(normalizeSearch)
    .flatMap(words);

  let score = 0;
  if (label === query) score += 1000;
  else if (label.startsWith(query)) score += 800;
  else if (labelWords.some((word) => word.startsWith(query))) score += 600;
  else if (label.includes(query)) score += 400;

  for (const token of query.split(' ')) {
    if (labelWords.some((word) => word.startsWith(token))) score += 100;
    else if (label.includes(token)) score += 50;
    else if (extraWords.some((word) => word.startsWith(token))) score += 30;
    else return 0;
  }
  return score;
}

/** The options that match, best first (ties keep their order). */
export function rankOptions<T extends SearchableOption>(
  options: ReadonlyArray<T>,
  query: string,
): T[] {
  const normalized = normalizeSearch(query);
  if (!normalized) return [...options];
  return options
    .map((option, index) => ({
      option,
      index,
      score: optionScore(option, normalized),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.option);
}
