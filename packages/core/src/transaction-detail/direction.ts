/**
 * "Es un ingreso" / "Es un gasto": a plain expense recorded as income or
 * the other way round, for banks that send money in with the sign of money
 * out ("MOBILE" transfers). Optionally an automatic name for that bank text
 * keeps doing it: the matching movements already recorded turn too and the
 * next synced ones arrive right. Shared by the web and the mobile app.
 */
import { aliasPatternGuess } from '../aliases/guess';
import type { NameSubject } from '../categorize/rename';
import type { GqlRunner } from '../graphql/request';

export const CHANGE_DIRECTION_MUTATION = `mutation ChangeTransactionDirection($input: ChangeDirectionInput!) { changeTransactionDirection(input: $input) { alsoChanged transaction { id } } }`;

/** Limits the API applies to an automatic name. */
export const DIRECTION_PATTERN_MAX = 200;
export const DIRECTION_NAME_MAX = 80;

export type MovementDirection = 'income' | 'expense';

/** What turning a movement around starts from. */
export interface DirectionChange {
  id: string;
  /** What it becomes. */
  to: MovementDirection;
  /** Unsigned amount and its currency. */
  amount: number;
  currency: string;
  /** A first guess of the text to look for (digits dropped); "" without one. */
  patternGuess: string;
  /** The name of the movements of a new automatic name. */
  nameGuess: string;
}

/**
 * Whether a movement can turn around, and into what: a plain expense or
 * income that isn't cancelled (transfers, loans and scheduled payments are
 * checked by the caller or the API).
 */
export function directionChangeOf(
  tx: {
    id: string;
    type: string;
    amount: number;
    currency: string;
    cancelledAt?: string | null;
  },
  name: Pick<NameSubject, 'displayName' | 'original'>,
): DirectionChange | null {
  if ((tx.type !== 'expense' && tx.type !== 'income') || tx.cancelledAt) {
    return null;
  }
  const patternGuess = aliasPatternGuess(name.original);
  return {
    id: tx.id,
    to: tx.type === 'expense' ? 'income' : 'expense',
    amount: Math.abs(tx.amount),
    currency: tx.currency,
    patternGuess,
    // Without a name of its own the bank text shows: use the pattern.
    nameGuess: (name.displayName && name.displayName !== name.original
      ? name.displayName
      : patternGuess || name.displayName
    ).slice(0, DIRECTION_NAME_MAX),
  };
}

export interface DirectionForm {
  /** Do the same with the movements whose bank text contains `pattern`. */
  remember: boolean;
  pattern: string;
  displayName: string;
}

export type DirectionErrorCode =
  | 'patternRequired'
  | 'patternTooLong'
  | 'nameRequired'
  | 'nameTooLong';

export type DirectionErrors = Partial<
  Record<'pattern' | 'displayName', DirectionErrorCode>
>;

export function newDirectionForm(change: DirectionChange): DirectionForm {
  return {
    remember: false,
    pattern: change.patternGuess,
    displayName: change.nameGuess,
  };
}

export function validateDirectionForm(form: DirectionForm): DirectionErrors {
  if (!form.remember) return {};
  const errors: DirectionErrors = {};
  const pattern = form.pattern.trim();
  const name = form.displayName.trim();
  if (!pattern) errors.pattern = 'patternRequired';
  else if (pattern.length > DIRECTION_PATTERN_MAX) {
    errors.pattern = 'patternTooLong';
  }
  if (!name) errors.displayName = 'nameRequired';
  else if (name.length > DIRECTION_NAME_MAX) errors.displayName = 'nameTooLong';
  return errors;
}

/** ChangeDirectionInput of a valid form. */
export function buildDirectionInput(
  change: DirectionChange,
  form: DirectionForm,
): Record<string, unknown> {
  return {
    id: change.id,
    type: change.to,
    ...(form.remember && {
      remember: {
        pattern: form.pattern.trim(),
        displayName: form.displayName.trim(),
      },
    }),
  };
}

/** Turns it around; returns how many other movements turned with it. */
export async function changeDirection(
  input: Record<string, unknown>,
  run: GqlRunner,
): Promise<number> {
  const data = await run<{
    changeTransactionDirection: { alsoChanged: number };
  }>(CHANGE_DIRECTION_MUTATION, { input });
  return data.changeTransactionDirection.alsoChanged;
}
