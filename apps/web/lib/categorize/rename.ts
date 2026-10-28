/**
 * The one-off alias of a single movement ("Renombrar"): a name and the
 * private flag, saved with setTransactionAlias. No rule is created.
 */
export const DISPLAY_NAME_MAX = 80;

export interface RenameForm {
  displayName: string;
  isPrivate: boolean;
}

export type RenameError = 'required' | 'tooLong';

export function renameFormOf(row: {
  displayName: string;
  hasOwnAlias: boolean;
  isPrivate: boolean;
}): RenameForm {
  return {
    displayName: row.hasOwnAlias ? row.displayName : '',
    isPrivate: row.hasOwnAlias ? row.isPrivate : false,
  };
}

export function validateRename(form: RenameForm): RenameError | null {
  const name = form.displayName.trim();
  if (!name) return 'required';
  if (name.length > DISPLAY_NAME_MAX) return 'tooLong';
  return null;
}

/** setTransactionAlias's input; removing the name clears both fields. */
export function renameInput(form: RenameForm | 'remove'): {
  displayName: string | null;
  isPrivate: boolean;
} {
  if (form === 'remove') return { displayName: null, isPrivate: false };
  return { displayName: form.displayName.trim(), isPrivate: form.isPrivate };
}
