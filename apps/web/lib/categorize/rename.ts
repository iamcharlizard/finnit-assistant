/**
 * A movement's own name ("nombre propio"): one name for this movement only
 * and its own private flag, saved with setTransactionAlias. It wins over
 * the automatic name (alias rule); empty means "use the automatic name or
 * the bank text". A rule can also make the movement private: that part is
 * the rule's, not changed here.
 */
export const DISPLAY_NAME_MAX = 80;

/** The automatic name (alias rule) that names a movement. */
export interface NameRule {
  id: string;
  displayName: string;
  isPrivate: boolean;
  isProtected: boolean;
}

/** What the name editor needs to know about a movement. */
export interface NameSubject {
  id: string;
  displayName: string;
  hasOwnAlias: boolean;
  /** The movement's own private flag (the rule may add privacy). */
  ownPrivate: boolean;
  rule: NameRule | null;
  /** The bank text, when the API sends it (not for private rows in lists). */
  original: string | null;
  categoryId: string | null;
}

export interface RenameForm {
  /** The own name; empty: none. */
  displayName: string;
  /** The movement's own private flag. */
  isPrivate: boolean;
}

export type RenameError = 'tooLong';

/** The editor's starting values: the own name (not the automatic one) and own privacy. */
export function renameFormOf(
  row: Pick<NameSubject, 'displayName' | 'hasOwnAlias' | 'ownPrivate'>,
): RenameForm {
  return {
    displayName: row.hasOwnAlias ? row.displayName : '',
    isPrivate: row.ownPrivate,
  };
}

export function validateRename(form: RenameForm): RenameError | null {
  return form.displayName.trim().length > DISPLAY_NAME_MAX ? 'tooLong' : null;
}

/** setTransactionAlias's input: an empty name removes the own name; privacy stays as chosen. */
export function renameInput(form: RenameForm): {
  displayName: string | null;
  isPrivate: boolean;
} {
  return {
    displayName: form.displayName.trim() || null,
    isPrivate: form.isPrivate,
  };
}

/** Private because of its automatic name (the switch can't turn that off). */
export function privateByRule(subject: Pick<NameSubject, 'rule'>): boolean {
  return Boolean(subject.rule?.isPrivate || subject.rule?.isProtected);
}

/** Whether saving would change anything. */
export function renameChanged(
  subject: Pick<NameSubject, 'displayName' | 'hasOwnAlias' | 'ownPrivate'>,
  form: RenameForm,
): boolean {
  const start = renameFormOf(subject);
  return (
    form.displayName.trim() !== start.displayName.trim() ||
    form.isPrivate !== start.isPrivate
  );
}

/** A transaction from the API as the name editor sees it. */
export function nameSubjectOf(tx: {
  id: string;
  displayName: string;
  hasOwnAlias?: boolean;
  isPrivate: boolean;
  ownPrivate?: boolean;
  aliasRule?: NameRule | null;
  originalDescription?: string | null;
  merchantName?: string | null;
  description?: string | null;
  category?: { id: string } | null;
}): NameSubject {
  const original =
    tx.originalDescription ??
    (tx.isPrivate ? null : (tx.merchantName ?? tx.description ?? null));
  return {
    id: tx.id,
    displayName: tx.displayName,
    hasOwnAlias: Boolean(tx.hasOwnAlias),
    // Older API without ownPrivate: the combined flag when there is no rule.
    ownPrivate: tx.ownPrivate ?? (tx.aliasRule ? false : tx.isPrivate),
    rule: tx.aliasRule ?? null,
    original: original?.trim() || null,
    categoryId: tx.category?.id ?? null,
  };
}
