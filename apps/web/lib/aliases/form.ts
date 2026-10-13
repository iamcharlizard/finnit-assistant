import type {
  AliasMatchType,
  ApiMerchantAlias,
  MerchantAliasInput,
} from './types';

/**
 * The create/edit alias form: plain strings while typing, validated and
 * turned into MerchantAliasInput on save. The preview uses the same input
 * once the pattern is valid.
 */
export const PATTERN_MAX = 200;
export const DISPLAY_NAME_MAX = 80;
export const PRIORITY_MIN = -1000;
export const PRIORITY_MAX = 1000;
export const DEFAULT_PRIORITY = 0;
/** Wait this long after the last keystroke before asking for a preview. */
export const PREVIEW_DEBOUNCE_MS = 400;
/** The preview lists at most this many samples. */
export const PREVIEW_SAMPLES = 20;

export interface AliasForm {
  matchType: AliasMatchType;
  pattern: string;
  displayName: string;
  categoryId: string | undefined;
  isPrivate: boolean;
  /** Text while typing; a whole number when valid. */
  priority: string;
  active: boolean;
}

export type AliasFormErrorCode =
  | 'patternRequired'
  | 'patternTooLong'
  | 'invalidRegex'
  | 'displayNameRequired'
  | 'displayNameTooLong'
  | 'priority';

export type AliasFormErrors = Partial<
  Record<'pattern' | 'displayName' | 'priority', AliasFormErrorCode>
>;

export function newAliasForm(initial: Partial<AliasForm> = {}): AliasForm {
  return {
    matchType: 'contains',
    pattern: '',
    displayName: '',
    categoryId: undefined,
    isPrivate: false,
    priority: String(DEFAULT_PRIORITY),
    active: true,
    ...initial,
  };
}

export function formOfAlias(alias: ApiMerchantAlias): AliasForm {
  return {
    matchType: alias.matchType,
    pattern: alias.pattern,
    displayName: alias.displayName,
    categoryId: alias.category?.id,
    isPrivate: alias.isPrivate,
    priority: String(alias.priority),
    active: alias.active,
  };
}

/**
 * Whether the browser can compile the pattern. The API checks again (its
 * engine may differ); its error is shown under the field too.
 */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, 'iu');
    return true;
  } catch {
    return false;
  }
}

function patternError(
  matchType: AliasMatchType,
  pattern: string,
): AliasFormErrorCode | undefined {
  const text = pattern.trim();
  if (!text) return 'patternRequired';
  if (text.length > PATTERN_MAX) return 'patternTooLong';
  if (matchType === 'regex' && !isValidRegex(text)) return 'invalidRegex';
  return undefined;
}

function parsePriority(value: string): number | null {
  const text = value.trim();
  if (!/^-?\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= PRIORITY_MIN && n <= PRIORITY_MAX ? n : null;
}

export function validateAliasForm(form: AliasForm): AliasFormErrors {
  const errors: AliasFormErrors = {};
  const pattern = patternError(form.matchType, form.pattern);
  if (pattern) errors.pattern = pattern;
  const name = form.displayName.trim();
  if (!name) errors.displayName = 'displayNameRequired';
  else if (name.length > DISPLAY_NAME_MAX) {
    errors.displayName = 'displayNameTooLong';
  }
  if (parsePriority(form.priority) === null) errors.priority = 'priority';
  return errors;
}

export function hasErrors(errors: AliasFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The API input of a valid form. */
export function buildAliasInput(form: AliasForm): MerchantAliasInput {
  return {
    matchType: form.matchType,
    pattern: form.pattern.trim(),
    displayName: form.displayName.trim(),
    categoryId: form.categoryId ?? null,
    isPrivate: form.isPrivate,
    priority: parsePriority(form.priority) ?? DEFAULT_PRIORITY,
    active: form.active,
  };
}

/**
 * previewMerchantAlias's input, or null while the pattern can't match
 * anything yet (empty, too long, a broken regex). Only the match matters to
 * the preview: the name (required by the input) is the pattern itself.
 */
export function previewInput(
  form: Pick<AliasForm, 'matchType' | 'pattern'>,
): MerchantAliasInput | null {
  if (patternError(form.matchType, form.pattern)) return null;
  const pattern = form.pattern.trim();
  return {
    matchType: form.matchType,
    pattern,
    displayName: pattern.slice(0, DISPLAY_NAME_MAX),
    categoryId: null,
    isPrivate: false,
    priority: DEFAULT_PRIORITY,
    active: true,
  };
}

/** Identifies a preview request: the same key needs no new request. */
export function previewKey(input: MerchantAliasInput | null): string | null {
  return input ? `${input.matchType}\u0000${input.pattern}` : null;
}

/** The full input of an existing alias with `active` changed (the switch). */
export function withActive(
  alias: ApiMerchantAlias,
  active: boolean,
): MerchantAliasInput {
  return {
    matchType: alias.matchType,
    pattern: alias.pattern,
    displayName: alias.displayName,
    categoryId: alias.category?.id ?? null,
    isPrivate: alias.isPrivate,
    priority: alias.priority,
    active,
  };
}
