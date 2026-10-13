/**
 * Every text this package shows to the user, in Spanish (Mexico) and
 * English. Spanish is the default so existing callers keep working.
 */
export type Locale = 'es' | 'en';

export const DEFAULT_LOCALE: Locale = 'es';

export interface Messages {
  /** Syncfy job status codes (sync-widget/widget/codes.md). */
  codes: Record<number, string>;
  /** Unknown codes, by family. */
  fallback: { progress: string; success: string; error: string };
  fields: { required: string; invalidOption: string; invalidFormat: string };
  flow: {
    loadingBanks: string;
    banksFailed: string;
    connectFailed: string;
    importing: string;
    linkFailed: string;
    saving: string;
    saveFailed: string;
  };
  client: { unreachable: string; sessionExpired: string; serviceError: string };
}

const ES: Messages = {
  codes: {
    100: 'Iniciando la conexión…',
    101: 'Preparando la conexión…',
    102: 'Sesión iniciada, descargando información…',
    103: 'Código recibido, continuando…',
    200: 'Banco conectado.',
    201: 'Banco conectado. Seguimos descargando información en segundo plano.',
    202: 'Banco conectado, pero no encontramos movimientos.',
    203: 'Banco conectado. Algunas cuentas no tienen movimientos.',
    204: 'Banco conectado, pero la información descargada está incompleta.',
    206: 'Banco conectado, pero no encontramos cuentas.',
    401: 'El banco no aceptó tus datos de acceso. Revísalos e intenta de nuevo.',
    403: 'El banco no aceptó el código o expiró. Intenta de nuevo.',
    405: 'Tu banco bloqueó el acceso. Comunícate con tu banco antes de intentar de nuevo.',
    406: 'Tu banco no permite dos sesiones a la vez. Cierra sesión en otros dispositivos e intenta de nuevo.',
    408: 'Tu banco requiere una acción. Entra a tu banca en línea, revisa que todo esté bien e intenta de nuevo.',
    409: 'Esos datos parecen ser de otro servicio del mismo banco (por ejemplo, empresas en lugar de personas).',
    410: 'Tu banco pide un dato adicional.',
    411: 'Se agotó el tiempo para escribir el código. Intenta de nuevo.',
    413: 'Hubo un error al iniciar sesión en tu banco. Intenta de nuevo.',
    500: 'Ocurrió un error al conectar con tu banco. Intenta más tarde.',
    501: 'Tu banco reporta un problema de conexión. Espera 15 minutos e intenta de nuevo.',
    504: 'Tu banco tardó demasiado en responder. Intenta más tarde.',
    509: 'Tu banco está en mantenimiento. Intenta más tarde.',
  },
  fallback: {
    progress: 'Conectando…',
    success: 'Banco conectado.',
    error: 'No pudimos conectar tu banco. Intenta más tarde.',
  },
  fields: {
    required: 'Este dato es obligatorio',
    invalidOption: 'Elige una de las opciones',
    invalidFormat: 'El formato no es válido',
  },
  flow: {
    loadingBanks: 'Cargando bancos…',
    banksFailed: 'No pudimos cargar la lista de bancos.',
    connectFailed: 'No pudimos conectar tu banco.',
    importing: 'Importando tus movimientos…',
    linkFailed: 'No pudimos ligar una de las cuentas. Intenta de nuevo.',
    saving: 'Guardando la conexión en Finnit…',
    saveFailed: 'Tu banco se conectó, pero no pudimos guardarlo en Finnit.',
  },
  client: {
    unreachable: 'No pudimos comunicarnos con el servicio de conexión bancaria',
    sessionExpired: 'La sesión de conexión expiró; vuelve a intentarlo',
    serviceError: 'El servicio de conexión bancaria respondió con un error',
  },
};

const EN: Messages = {
  codes: {
    100: 'Starting the connection…',
    101: 'Preparing the connection…',
    102: 'Signed in, downloading your information…',
    103: 'Code received, continuing…',
    200: 'Bank connected.',
    201: 'Bank connected. We keep downloading information in the background.',
    202: 'Bank connected, but we found no transactions.',
    203: 'Bank connected. Some accounts have no transactions.',
    204: 'Bank connected, but the downloaded information is incomplete.',
    206: 'Bank connected, but we found no accounts.',
    401: "Your bank didn't accept your sign-in details. Check them and try again.",
    403: "Your bank didn't accept the code or it expired. Try again.",
    405: 'Your bank blocked access. Contact your bank before trying again.',
    406: "Your bank doesn't allow two sessions at once. Sign out on other devices and try again.",
    408: 'Your bank needs you to take an action. Sign in to your online banking, check that everything is fine and try again.',
    409: 'Those details seem to belong to another service of the same bank (for example, business instead of personal).',
    410: 'Your bank is asking for additional information.',
    411: 'Time ran out to enter the code. Try again.',
    413: 'Something went wrong signing in to your bank. Try again.',
    500: 'Something went wrong connecting to your bank. Try again later.',
    501: 'Your bank reports a connection problem. Wait 15 minutes and try again.',
    504: 'Your bank took too long to respond. Try again later.',
    509: 'Your bank is under maintenance. Try again later.',
  },
  fallback: {
    progress: 'Connecting…',
    success: 'Bank connected.',
    error: "We couldn't connect your bank. Try again later.",
  },
  fields: {
    required: 'This field is required',
    invalidOption: 'Choose one of the options',
    invalidFormat: 'The format is not valid',
  },
  flow: {
    loadingBanks: 'Loading banks…',
    banksFailed: "We couldn't load the list of banks.",
    connectFailed: "We couldn't connect your bank.",
    importing: 'Importing your transactions…',
    linkFailed: "We couldn't link one of the accounts. Try again.",
    saving: 'Saving the connection in Finnit…',
    saveFailed: "Your bank is connected, but we couldn't save it in Finnit.",
  },
  client: {
    unreachable: "We couldn't reach the bank connection service",
    sessionExpired: 'The connection session expired; please try again',
    serviceError: 'The bank connection service responded with an error',
  },
};

const MESSAGES: Record<Locale, Messages> = { es: ES, en: EN };

/** The texts for a locale; anything unknown falls back to Spanish. */
export function messagesFor(locale: Locale | undefined): Messages {
  return (locale && MESSAGES[locale]) || MESSAGES[DEFAULT_LOCALE];
}
