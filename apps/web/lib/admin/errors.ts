/**
 * The API answers admin mutations with English messages; the panel shows
 * these Spanish ones instead.
 */
const MESSAGES: [RegExp, string][] = [
  [
    /user with this email already exists/i,
    'Ya existe un usuario con ese correo.',
  ],
  [
    /master administrator stays an admin/i,
    'El administrador maestro siempre es administrador.',
  ],
  [
    /master administrator cannot be disabled/i,
    'No se puede desactivar al administrador maestro.',
  ],
  [/cannot disable yourself/i, 'No puedes desactivar tu propia cuenta.'],
  [
    /master administrator can change their own account/i,
    'Solo el administrador maestro puede cambiar su cuenta.',
  ],
  [
    /only the master administrator can/i,
    'Solo el administrador maestro puede hacer esto.',
  ],
  [
    /no Google account linked/i,
    'Aún no entra con Google: sin contraseña no podría entrar.',
  ],
  [/already in the catalog/i, 'Ese modelo ya está en el catálogo.'],
  [
    /default model must be active/i,
    'El modelo predeterminado debe estar activo.',
  ],
  [/active model that supports PDF/i, 'Elige un modelo activo que lea PDF.'],
  [/model id and label are required/i, 'Escribe el modelo y su nombre.'],
  [/not found/i, 'Ya no existe. Recarga la página.'],
];

const BY_CODE: Record<string, string> = {
  FORBIDDEN: 'No tienes permiso para hacer esto.',
  NOT_FOUND: 'Ya no existe. Recarga la página.',
  CONFLICT: 'Ya existe.',
  VALIDATION_ERROR: 'Revisa los datos e intenta de nuevo.',
  BAD_REQUEST: 'Revisa los datos e intenta de nuevo.',
  BAD_USER_INPUT: 'Revisa los datos e intenta de nuevo.',
  GRAPHQL_VALIDATION_FAILED: 'Revisa los datos e intenta de nuevo.',
};

export function adminErrorMessage(error: unknown): string {
  const { message = '', code } = (error ?? {}) as {
    message?: string;
    code?: string;
  };
  const known = MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return known[1];
  if (code && BY_CODE[code]) return BY_CODE[code];
  // Errors without a code come from lib/graphql/client.ts, already in Spanish.
  if (!code && message) return message;
  return 'Ocurrió un error. Intenta de nuevo.';
}
