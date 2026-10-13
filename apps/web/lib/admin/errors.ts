import type { Translate } from '@/lib/i18n/translator';

type AdminErrorKey = Parameters<Translate>[0] & `admin.errors.${string}`;

/**
 * The API answers admin mutations with English messages; the panel shows
 * these, in the user's language, instead.
 */
const MESSAGES: [RegExp, AdminErrorKey][] = [
  [/user with this email already exists/i, 'admin.errors.emailExists'],
  [/master administrator stays an admin/i, 'admin.errors.masterStaysAdmin'],
  [
    /master administrator cannot be disabled/i,
    'admin.errors.masterCannotBeDisabled',
  ],
  [/cannot disable yourself/i, 'admin.errors.cannotDisableSelf'],
  [
    /master administrator can change their own account/i,
    'admin.errors.masterOwnAccount',
  ],
  [/only the master administrator can/i, 'admin.errors.onlyMaster'],
  [/no Google account linked/i, 'admin.errors.noGoogleLinked'],
  [/already in the catalog/i, 'admin.errors.modelExists'],
  [/default model must be active/i, 'admin.errors.defaultMustBeActive'],
  [/active model that supports PDF/i, 'admin.errors.pdfModelRequired'],
  [/model id and label are required/i, 'admin.errors.modelFieldsRequired'],
  [/not found/i, 'admin.errors.notFound'],
];

const BY_CODE: Record<string, AdminErrorKey> = {
  FORBIDDEN: 'admin.errors.forbidden',
  NOT_FOUND: 'admin.errors.notFound',
  CONFLICT: 'admin.errors.conflict',
  VALIDATION_ERROR: 'admin.errors.invalid',
  BAD_REQUEST: 'admin.errors.invalid',
  BAD_USER_INPUT: 'admin.errors.invalid',
  GRAPHQL_VALIDATION_FAILED: 'admin.errors.invalid',
  NETWORK_ERROR: 'errors.network' as AdminErrorKey,
  UNAUTHENTICATED: 'errors.sessionEnded' as AdminErrorKey,
};

export function adminErrorMessage(error: unknown, t: Translate): string {
  const { message = '', code } = (error ?? {}) as {
    message?: string;
    code?: string;
  };
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return t(known[1]);
  if (code && Object.hasOwn(BY_CODE, code)) return t(BY_CODE[code]!);
  return t('admin.errors.generic');
}
