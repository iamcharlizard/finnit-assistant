/**
 * Runs the native flow against Syncfy's sandbox test sites (no real banks).
 * The API key is only used here, server-side style, to create a throwaway
 * user and session; the flow itself only uses the session token.
 *
 *   SYNCFY_API_KEY_SANDBOX=… pnpm --filter @finnit/bank-connect sandbox-check
 */
import {
  connectBank,
  SyncfyConnectClient,
  isNativeSupported,
  type FieldValues,
  type TwofaField,
} from '../src';

const KEY = process.env.SYNCFY_API_KEY_SANDBOX;
if (!KEY) throw new Error('SYNCFY_API_KEY_SANDBOX is not set');
const API = 'https://api.syncfy.com/v1';

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return ((await res.json()) as { response: T }).response;
}

/** What a user would answer in the sandbox. */
function answer(fields: TwofaField[]): FieldValues {
  const values: FieldValues = {};
  for (const f of fields) {
    values[f.name] = f.options?.length
      ? f.options[0]!.value
      : f.type === 'externalAction'
        ? ''
        : 'test';
  }
  return values;
}

const CASES: [string, string, FieldValues, string][] = [
  [
    'Normal (Simple Auth)',
    '56cf5728784806f72b8b4568',
    { username: 'test', password: 'test' },
    'ok',
  ],
  [
    'Token (2FA)',
    '56cf5728784806f72b8b4569',
    { username: 'test', password: 'test' },
    'ok',
  ],
  [
    'Multiple Image (2FA)',
    '573ce20978480645038b4589',
    { username: 'test', password: 'test' },
    'ok',
  ],
  [
    'Multiple Text (2FA)',
    '58e28bce056f2903900d4d61',
    { username: 'test', password: 'test' },
    'ok',
  ],
  [
    'Multiple Twofa (2FA)',
    '6494465d98b6c8c533e8762d',
    { username: 'test', password: 'test' },
    'ok',
  ],
  [
    'QR Code Scan (2FA)',
    '5efe27e84cc5f861897a5431',
    { username: 'test', password: 'test' },
    'ok',
  ],
  [
    'Select Input',
    '5ae37e06056f290607126261',
    { type: '01', username: 'test', password: 'test' },
    'ok',
  ],
  [
    'Wrong password',
    '56cf5728784806f72b8b4568',
    { username: 'test', password: 'wrong' },
    '401',
  ],
];

async function main() {
  const user = await api<{ id_user: string }>('POST', '/users', {
    api_key: KEY,
    id_external: `finnit-sandbox-check-${Date.now()}`,
    name: 'finnit-sandbox-check',
  });
  try {
    const { token } = await api<{ token: string }>('POST', '/sessions', {
      api_key: KEY,
      id_user: user.id_user,
    });
    const client = new SyncfyConnectClient(token);
    const sites = await client.listSites();
    console.log(
      `catalog: ${sites.length} sites, ${sites.filter(isNativeSupported).length} native`,
    );

    for (const [name, idSite, values, expected] of CASES) {
      const rounds: string[] = [];
      const started = Date.now();
      const result = await connectBank(client, idSite, values, {
        onTwofa: async (fields) => {
          rounds.push(fields.map((f) => f.type).join('+'));
          return answer(fields);
        },
      });
      const outcome = result.ok ? 'ok' : String(result.code);
      console.log(
        `${outcome === expected ? 'PASS' : 'FAIL'} ${name.padEnd(22)} → ${outcome} ${rounds.length ? `(2FA: ${rounds.join(', ')}) ` : ''}${Math.round((Date.now() - started) / 1000)}s — ${result.info.message}`,
      );
    }
  } finally {
    await fetch(
      `${API}/users/${user.id_user}?api_key=${encodeURIComponent(KEY!)}`,
      { method: 'DELETE' },
    );
  }
}

main().catch((error: Error) => {
  console.error(error.message.split(KEY!).join('***'));
  process.exit(1);
});
