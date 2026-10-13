/**
 * Syncfy job status codes (sync-widget/widget/codes.md), with the message
 * shown to the user in Spanish.
 */
export type CodeKind = 'progress' | 'waiting' | 'success' | 'error';

export interface CodeInfo {
  kind: CodeKind;
  message: string;
  /** The user can fix it by trying again (e.g. wrong password). */
  retryable: boolean;
}

const CODES: Record<number, CodeInfo> = {
  100: {
    kind: 'progress',
    message: 'Iniciando la conexión…',
    retryable: false,
  },
  101: {
    kind: 'progress',
    message: 'Preparando la conexión…',
    retryable: false,
  },
  102: {
    kind: 'progress',
    message: 'Sesión iniciada, descargando información…',
    retryable: false,
  },
  103: {
    kind: 'progress',
    message: 'Código recibido, continuando…',
    retryable: false,
  },
  200: { kind: 'success', message: 'Banco conectado.', retryable: false },
  201: {
    kind: 'success',
    message:
      'Banco conectado. Seguimos descargando información en segundo plano.',
    retryable: false,
  },
  202: {
    kind: 'success',
    message: 'Banco conectado, pero no encontramos movimientos.',
    retryable: false,
  },
  203: {
    kind: 'success',
    message: 'Banco conectado. Algunas cuentas no tienen movimientos.',
    retryable: false,
  },
  204: {
    kind: 'success',
    message: 'Banco conectado, pero la información descargada está incompleta.',
    retryable: false,
  },
  206: {
    kind: 'success',
    message: 'Banco conectado, pero no encontramos cuentas.',
    retryable: false,
  },
  401: {
    kind: 'error',
    message:
      'El banco no aceptó tus datos de acceso. Revísalos e intenta de nuevo.',
    retryable: true,
  },
  403: {
    kind: 'error',
    message: 'El banco no aceptó el código o expiró. Intenta de nuevo.',
    retryable: true,
  },
  405: {
    kind: 'error',
    message:
      'Tu banco bloqueó el acceso. Comunícate con tu banco antes de intentar de nuevo.',
    retryable: false,
  },
  406: {
    kind: 'error',
    message:
      'Tu banco no permite dos sesiones a la vez. Cierra sesión en otros dispositivos e intenta de nuevo.',
    retryable: true,
  },
  408: {
    kind: 'error',
    message:
      'Tu banco requiere una acción. Entra a tu banca en línea, revisa que todo esté bien e intenta de nuevo.',
    retryable: true,
  },
  409: {
    kind: 'error',
    message:
      'Esos datos parecen ser de otro servicio del mismo banco (por ejemplo, empresas en lugar de personas).',
    retryable: true,
  },
  410: {
    kind: 'waiting',
    message: 'Tu banco pide un dato adicional.',
    retryable: false,
  },
  411: {
    kind: 'error',
    message: 'Se agotó el tiempo para escribir el código. Intenta de nuevo.',
    retryable: true,
  },
  413: {
    kind: 'error',
    message: 'Hubo un error al iniciar sesión en tu banco. Intenta de nuevo.',
    retryable: true,
  },
  500: {
    kind: 'error',
    message: 'Ocurrió un error al conectar con tu banco. Intenta más tarde.',
    retryable: true,
  },
  501: {
    kind: 'error',
    message:
      'Tu banco reporta un problema de conexión. Espera 15 minutos e intenta de nuevo.',
    retryable: true,
  },
  504: {
    kind: 'error',
    message: 'Tu banco tardó demasiado en responder. Intenta más tarde.',
    retryable: true,
  },
  509: {
    kind: 'error',
    message: 'Tu banco está en mantenimiento. Intenta más tarde.',
    retryable: true,
  },
};

export function describeCode(code: number): CodeInfo {
  return (
    CODES[code] ??
    (code >= 200 && code < 300
      ? { kind: 'success', message: 'Banco conectado.', retryable: false }
      : code < 200
        ? { kind: 'progress', message: 'Conectando…', retryable: false }
        : {
            kind: 'error',
            message: 'No pudimos conectar tu banco. Intenta más tarde.',
            retryable: true,
          })
  );
}
