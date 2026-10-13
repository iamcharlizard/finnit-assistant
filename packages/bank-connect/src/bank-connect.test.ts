import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  connectBank,
  describeCode,
  isNativeSupported,
  personalBanks,
  SyncfyConnectClient,
  SyncfyRequestError,
  validateFields,
  BANK_ORGANIZATION_TYPE,
  type JobStatus,
  type Site,
  type TwofaField,
} from './index';

type Call = { url: string; init: RequestInit };

/** fetch stub answering with the queued bodies, recording every call. */
function stubFetch(responses: { status?: number; body: unknown }[]) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift() ?? { body: { response: [] } };
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
    });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

const STATUS_URL = 'https://sync.paybook.com/v1/jobs/job-1/status';
const TWOFA_URL = 'https://sync.paybook.com/v1/jobs/job-1/twofa';
const created = {
  body: {
    response: {
      id_credential: 'cred-1',
      id_job: 'job-1',
      status: STATUS_URL,
      twofa: TWOFA_URL,
    },
  },
};
const statuses = (...list: JobStatus[]) => ({ body: { response: list } });

describe('SyncfyConnectClient', () => {
  it('sends the session token as a bearer header to Syncfy', async () => {
    const { calls, fetchFn } = stubFetch([created]);
    const client = new SyncfyConnectClient('tok', fetchFn);
    await client.createCredential('site-1', { username: 'u', password: 'p' });
    assert.equal(calls[0]!.url, 'https://api.syncfy.com/v1/credentials/pulls');
    assert.equal(
      (calls[0]!.init.headers as Record<string, string>).authorization,
      'Bearer tok',
    );
    assert.deepEqual(JSON.parse(calls[0]!.init.body as string), {
      id_site: 'site-1',
      credentials: { username: 'u', password: 'p' },
    });
  });

  it('never sends the token to other hosts or over http', async () => {
    const { calls, fetchFn } = stubFetch([]);
    const client = new SyncfyConnectClient('tok', fetchFn);
    for (const url of [
      'https://evil.example.com/v1/jobs/1/status',
      'https://sync.paybook.com.evil.com/x',
      'http://sync.paybook.com/v1/jobs/1/status',
    ]) {
      await assert.rejects(client.jobStatus(url), SyncfyRequestError);
    }
    assert.equal(calls.length, 0);
  });

  it('reports an expired session clearly', async () => {
    const { fetchFn } = stubFetch([{ status: 401, body: {} }]);
    await assert.rejects(
      new SyncfyConnectClient('old', fetchFn).listSites(),
      /expiró/,
    );
  });
});

describe('forms', () => {
  const site = (overrides: Partial<Site> = {}): Site => ({
    id_site: 's',
    name: 'BancaNet Personal',
    version: 1,
    is_personal: 1,
    id_site_organization_type: BANK_ORGANIZATION_TYPE,
    credentials: [
      { name: 'username', type: 'text', label: 'Usuario', required: true },
      {
        name: 'password',
        type: 'password',
        label: 'Contraseña',
        required: true,
      },
    ],
    ...overrides,
  });

  it('supports version 1 sites with text, password and select fields', () => {
    assert.equal(isNativeSupported(site()), true);
    assert.equal(isNativeSupported(site({ version: 4 })), false);
    assert.equal(
      isNativeSupported(
        site({ credentials: [{ name: 'x', type: 'array', label: 'X' }] }),
      ),
      false,
    );
  });

  it('lists personal banks, natively supported first', () => {
    const list = personalBanks([
      site({ id_site: 'b', name: 'Banorte Personal', version: 4 }),
      site({ id_site: 'a', name: 'Banamex' }),
      site({ id_site: 'sat', name: 'SAT', id_site_organization_type: 'gov' }),
      site({ id_site: 'e', name: 'Empresas', is_personal: 0 }),
    ]);
    assert.deepEqual(
      list.map((s) => s.id_site),
      ['a', 'b'],
    );
  });

  it('validates required fields, options and patterns', () => {
    const fields = [
      {
        name: 'username',
        type: 'text',
        label: 'U',
        required: true,
        validation: '^\\d+$',
      },
      {
        name: 'type',
        type: 'select',
        label: 'T',
        required: true,
        options: [{ label: 'A', value: '01' }],
      },
    ];
    assert.deepEqual(validateFields(fields, { username: 'abc', type: '02' }), [
      { name: 'username', message: 'El formato no es válido' },
      { name: 'type', message: 'Elige una de las opciones' },
    ]);
    assert.deepEqual(
      validateFields(fields, { username: '123', type: '01' }),
      [],
    );
    assert.equal(validateFields(fields, {}).length, 2);
    assert.deepEqual(
      validateFields(fields, { username: 'abc', type: '02' }, 'en'),
      [
        { name: 'username', message: 'The format is not valid' },
        { name: 'type', message: 'Choose one of the options' },
      ],
    );
    assert.deepEqual(validateFields(fields, {}, 'en')[0], {
      name: 'username',
      message: 'This field is required',
    });
  });
});

describe('connectBank', () => {
  const fast = { pollIntervalMs: 1 };

  it('connects without a second factor', async () => {
    const { fetchFn } = stubFetch([
      created,
      statuses({ code: 100 }),
      statuses({ code: 100 }, { code: 102 }, { code: 200 }),
    ]);
    const seen: number[] = [];
    const result = await connectBank(
      new SyncfyConnectClient('tok', fetchFn),
      'site-1',
      { username: 'u', password: 'p' },
      {
        onStatus: (code) => seen.push(code),
        onTwofa: () => assert.fail('no second factor expected'),
      },
      fast,
    );
    assert.deepEqual(result.ok && result.idCredential, 'cred-1');
    assert.deepEqual(seen, [100, 200]);
  });

  it('answers every second-factor round once', async () => {
    const round1: TwofaField[] = [
      {
        name: 'token',
        type: 'textOptions',
        label: 'Elige',
        options: [{ label: 'A', value: 0 }],
      },
    ];
    const round2: TwofaField[] = [
      { name: 'token', type: 'text', label: 'Código' },
    ];
    const address = TWOFA_URL;
    const { calls, fetchFn } = stubFetch([
      created,
      statuses({ code: 100 }, { code: 410, address, twofa: round1 }),
      { body: { response: true } },
      statuses({ code: 100 }, { code: 410, address, twofa: round1 }),
      statuses(
        { code: 100 },
        { code: 410, address, twofa: round1 },
        { code: 103 },
        { code: 410, address, twofa: round2 },
      ),
      { body: { response: true } },
      statuses(
        { code: 100 },
        { code: 410 },
        { code: 103 },
        { code: 410 },
        { code: 200 },
      ),
    ]);
    const asked: string[] = [];
    const result = await connectBank(
      new SyncfyConnectClient('tok', fetchFn),
      'site-1',
      { username: 'u', password: 'p' },
      {
        onTwofa: async (fields) => {
          asked.push(fields[0]!.type);
          return fields[0]!.type === 'text'
            ? { token: ' 123456 ' }
            : { token: 0 };
        },
      },
      fast,
    );

    assert.equal(result.ok, true);
    assert.deepEqual(asked, ['textOptions', 'text']);
    const posts = calls.filter((c) => c.url === TWOFA_URL);
    assert.deepEqual(
      posts.map((c) => JSON.parse(c.init.body as string)),
      [{ twofa: { token: 0 } }, { twofa: { token: '123456' } }],
    );
  });

  it('waits for an external action (QR) without sending anything', async () => {
    const qr: TwofaField[] = [
      {
        name: 'customtoken',
        type: 'externalAction',
        label: 'Escanea',
        imgBase64File: 'data:image/png;base64,AA',
      },
    ];
    const { calls, fetchFn } = stubFetch([
      created,
      statuses({ code: 100 }, { code: 410, address: TWOFA_URL, twofa: qr }),
      statuses({ code: 100 }, { code: 410 }, { code: 103 }, { code: 200 }),
    ]);
    let shown = 0;
    const result = await connectBank(
      new SyncfyConnectClient('tok', fetchFn),
      'site-1',
      {},
      {
        onTwofa: async () => {
          shown += 1;
          return {};
        },
      },
      fast,
    );
    assert.equal(result.ok, true);
    assert.equal(shown, 1);
    assert.equal(calls.filter((c) => c.url === TWOFA_URL).length, 0);
  });

  it('falls back to the widget for an unknown second factor', async () => {
    const { fetchFn } = stubFetch([
      created,
      statuses({
        code: 410,
        address: TWOFA_URL,
        twofa: [{ name: 'x', type: 'faceId', label: '?' }],
      }),
    ]);
    const result = await connectBank(
      new SyncfyConnectClient('tok', fetchFn),
      'site-1',
      {},
      { onTwofa: () => assert.fail('must not ask') },
      fast,
    );
    assert.deepEqual(result, {
      ok: false,
      needsWidget: true,
      idCredential: 'cred-1',
      code: 410,
      info: describeCode(410),
    });
  });

  it('reports bank errors with a user message', async () => {
    const { fetchFn } = stubFetch([
      created,
      statuses({ code: 100 }, { code: 401 }),
    ]);
    const result = await connectBank(
      new SyncfyConnectClient('tok', fetchFn),
      'site-1',
      {},
      { onTwofa: async () => ({}) },
      fast,
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 401);
    assert.equal(result.info.retryable, true);
    assert.match(result.info.message, /no aceptó tus datos/);
  });

  it('reports status messages in English when asked', async () => {
    const { fetchFn } = stubFetch([
      created,
      statuses({ code: 100 }, { code: 401 }),
    ]);
    const seen: string[] = [];
    const result = await connectBank(
      new SyncfyConnectClient('tok', fetchFn),
      'site-1',
      {},
      {
        onTwofa: async () => ({}),
        onStatus: (_code, info) => seen.push(info.message),
      },
      { ...fast, locale: 'en' },
    );
    assert.equal(result.code, 401);
    assert.match(result.info.message, /didn't accept your sign-in details/);
    // Only the latest status of each poll is reported.
    assert.deepEqual(seen, [result.info.message]);
  });

  it('can be cancelled', async () => {
    const controller = new AbortController();
    const { fetchFn } = stubFetch([created, statuses({ code: 100 })]);
    const pending = connectBank(
      new SyncfyConnectClient('tok', fetchFn),
      'site-1',
      {},
      { onTwofa: async () => ({}), signal: controller.signal },
      { pollIntervalMs: 1000 },
    );
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(pending, { name: 'AbortError' });
  });

  it('gives up after the timeout', async () => {
    const { fetchFn } = stubFetch([created]);
    const result = await connectBank(
      new SyncfyConnectClient('tok', fetchFn),
      'site-1',
      {},
      { onTwofa: async () => ({}) },
      { pollIntervalMs: 1, timeoutMs: 20 },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 504);
  });
});

describe('describeCode', () => {
  it('classifies known and unknown codes', () => {
    assert.equal(describeCode(201).kind, 'success');
    assert.equal(describeCode(410).kind, 'waiting');
    assert.equal(describeCode(299).kind, 'success');
    assert.equal(describeCode(599).kind, 'error');
  });

  it('speaks Spanish by default and English on request', () => {
    assert.equal(describeCode(200).message, 'Banco conectado.');
    assert.equal(describeCode(200, 'es').message, 'Banco conectado.');
    assert.equal(describeCode(200, 'en').message, 'Bank connected.');
    assert.equal(describeCode(299, 'en').message, 'Bank connected.');
    assert.equal(describeCode(150, 'en').message, 'Connecting…');
    assert.deepEqual(describeCode(405, 'en'), {
      kind: 'error',
      message:
        'Your bank blocked access. Contact your bank before trying again.',
      retryable: false,
    });
  });

  it('has an English text for every Spanish code', () => {
    for (const code of [
      100, 101, 102, 103, 200, 201, 202, 203, 204, 206, 401, 403, 405, 406, 408,
      409, 410, 411, 413, 500, 501, 504, 509,
    ]) {
      const es = describeCode(code, 'es');
      const en = describeCode(code, 'en');
      assert.notEqual(en.message, es.message, `code ${code}`);
      assert.equal(en.kind, es.kind);
      assert.equal(en.retryable, es.retryable);
    }
  });
});

describe('SyncfyConnectClient errors', () => {
  it('uses the requested language', async () => {
    const failing = (async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    await assert.rejects(new SyncfyConnectClient('tok', failing).listSites(), {
      message: 'No pudimos comunicarnos con el servicio de conexión bancaria',
    });
    await assert.rejects(
      new SyncfyConnectClient('tok', failing, 'en').listSites(),
      { message: "We couldn't reach the bank connection service" },
    );
  });
});
