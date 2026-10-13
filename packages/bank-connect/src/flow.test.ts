import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  BANK_ORGANIZATION_TYPE,
  BankConnectFlow,
  type BankConnectApi,
  type ConnectedBank,
  type FlowStep,
  type Site,
} from './index';

const banamex: Site = {
  id_site: 'site-banamex',
  name: 'BancaNet Personal',
  version: 1,
  is_personal: 1,
  id_site_organization_type: BANK_ORGANIZATION_TYPE,
  credentials: [
    { name: 'username', type: 'text', label: 'Usuario', required: true },
    { name: 'password', type: 'password', label: 'Contraseña', required: true },
  ],
};
const v4Bank: Site = {
  ...banamex,
  id_site: 'site-v4',
  name: 'Banco V4',
  version: 4,
};

const bank: ConnectedBank = {
  id: 'conn-1',
  institution: 'BancaNet Personal',
  accounts: [
    { id: 'la-card', name: 'Tarjeta', type: 'Credit Card' },
    { id: 'la-debit', name: 'Nómina', type: 'Checking' },
    { id: 'la-savings', name: 'Ahorro', type: 'Savings' },
  ],
};

/** Syncfy over a scripted fetch: catalog, then a login job with the given statuses. */
function syncfy(jobs: { code: number; twofa?: unknown[] }[][]) {
  const sent: unknown[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    const json = (response: unknown) =>
      new Response(JSON.stringify({ response }), { status: 200 });
    if (url.endsWith('/catalogues/sites')) return json([v4Bank, banamex]);
    if (url.endsWith('/credentials/pulls')) {
      sent.push(JSON.parse(init.body as string));
      return json({
        id_credential: 'cred-1',
        id_job: 'job',
        status: 'https://sync.paybook.com/v1/jobs/job/status',
        twofa: 'https://sync.paybook.com/v1/jobs/job/twofa',
      });
    }
    if (url.endsWith('/twofa')) {
      sent.push(JSON.parse(init.body as string));
      return json(true);
    }
    return json(jobs.shift() ?? [{ code: 200 }]);
  }) as unknown as typeof fetch;
  return { fetchFn, sent };
}

function fakeApi(overrides: Partial<BankConnectApi> = {}) {
  const calls: unknown[][] = [];
  const api: BankConnectApi = {
    createSession: async () => ({
      token: 'tok',
      widgetScriptUrl: 'https://www.syncfy.com/widget.js',
      widgetStylesheetUrl: 'https://www.syncfy.com/widget.css',
    }),
    registerConnection: async (id) => {
      calls.push(['register', id]);
      return bank;
    },
    linkAccount: async (...args) => {
      calls.push(['link', ...args]);
    },
    ...overrides,
  };
  return { api, calls };
}

/** Current step, without TypeScript narrowing it across awaits. */
const stepOf = (flow: BankConnectFlow): FlowStep => flow.step;

/** Resolves when the flow reaches `name`. */
const reach = (flow: BankConnectFlow, name: FlowStep['name']) =>
  new Promise<FlowStep>((resolve) => {
    if (stepOf(flow).name === name) return resolve(stepOf(flow));
    const off = flow.subscribe((step) => {
      if (step.name === name) {
        off();
        resolve(step);
      }
    });
  });

describe('BankConnectFlow', () => {
  it('connects a bank with a second factor and links the chosen accounts', async () => {
    const { fetchFn, sent } = syncfy([
      [
        { code: 100 },
        {
          code: 410,
          twofa: [{ name: 'token', type: 'text', label: 'Código' }],
        },
      ],
      [{ code: 100 }, { code: 410 }, { code: 103 }, { code: 200 }],
    ]);
    const { api, calls } = fakeApi();
    const flow = new BankConnectFlow(api, fetchFn);

    assert.equal(stepOf(flow).name, 'consent');
    await flow.acceptConsent();
    const pick = stepOf(flow);
    assert.equal(pick.name, 'pickBank');
    // Natively supported banks first.
    assert.deepEqual(
      pick.name === 'pickBank' && pick.banks.map((b) => b.id_site),
      ['site-banamex', 'site-v4'],
    );
    assert.deepEqual(
      flow.search('banca').map((b) => b.name),
      ['BancaNet Personal'],
    );

    flow.selectBank(banamex);
    const connecting = flow.submitCredentials({
      username: ' ana ',
      password: 'secret',
    });
    const twofa = await reach(flow, 'twofa');
    assert.equal(twofa.name === 'twofa' && twofa.fields[0]!.name, 'token');
    flow.submitTwofa({}); // required: stays with an error
    const invalid = stepOf(flow);
    assert.equal(invalid.name === 'twofa' && invalid.errors.length, 1);
    flow.submitTwofa({ token: '123456' });
    await connecting;

    assert.equal(stepOf(flow).name, 'linkAccounts');
    assert.deepEqual(calls, [['register', 'cred-1']]);
    assert.deepEqual(sent, [
      {
        id_site: 'site-banamex',
        credentials: { username: ' ana ', password: 'secret' },
      },
      { twofa: { token: '123456' } },
    ]);

    await flow.linkAccounts({
      'la-card': 'create',
      'la-debit': { accountId: 'acc-nomina' },
      'la-savings': 'skip',
    });
    const done = stepOf(flow);
    assert.equal(done.name === 'done' && done.linked, 2);
    assert.deepEqual(
      done.name === 'done' && done.bank.accounts.map((a) => a.accountId),
      ['new', 'acc-nomina', undefined],
    );
    assert.deepEqual(calls.slice(1), [
      ['link', 'la-card', { createAccount: true }],
      ['link', 'la-debit', { accountId: 'acc-nomina' }],
    ]);
  });

  it('validates the login form before calling Syncfy', async () => {
    const { fetchFn, sent } = syncfy([]);
    const flow = new BankConnectFlow(fakeApi().api, fetchFn);
    await flow.acceptConsent();
    flow.selectBank(banamex);
    await flow.submitCredentials({ username: 'ana' });
    const step = stepOf(flow);
    assert.equal(step.name, 'credentials');
    assert.deepEqual(step.name === 'credentials' && step.errors, [
      { name: 'password', message: 'Este dato es obligatorio' },
    ]);
    assert.equal(sent.length, 0);
  });

  it('returns to the form with the bank message on a wrong password', async () => {
    const { fetchFn } = syncfy([[{ code: 100 }, { code: 401 }]]);
    const flow = new BankConnectFlow(fakeApi().api, fetchFn);
    await flow.acceptConsent();
    flow.selectBank(banamex);
    await flow.submitCredentials({ username: 'ana', password: 'bad' });
    const step = stepOf(flow);
    assert.equal(step.name, 'credentials');
    assert.match(
      step.name === 'credentials' ? step.message! : '',
      /no aceptó tus datos/,
    );
  });

  it("sends banks it can't render to Syncfy's widget", async () => {
    const flow = new BankConnectFlow(fakeApi().api, syncfy([]).fetchFn);
    await flow.acceptConsent();
    flow.selectBank(v4Bank);
    const step = stepOf(flow);
    assert.equal(step.name, 'needsWidget');
    assert.equal(step.name === 'needsWidget' && step.token, 'tok');
    flow.back();
    assert.equal(stepOf(flow).name, 'pickBank');
  });

  it('keeps the bank connected but reports a failure to save it in Finnit', async () => {
    const { api } = fakeApi({
      registerConnection: async () => {
        throw new Error('network');
      },
    });
    const flow = new BankConnectFlow(api, syncfy([[{ code: 200 }]]).fetchFn);
    await flow.acceptConsent();
    flow.selectBank(banamex);
    await flow.submitCredentials({ username: 'ana', password: 'x' });
    assert.deepEqual(stepOf(flow), {
      name: 'error',
      message: 'Tu banco se conectó, pero no pudimos guardarlo en Finnit.',
      canRetry: true,
    });
  });

  it('can be cancelled while connecting', async () => {
    const { fetchFn } = syncfy([
      [{ code: 100 }],
      [{ code: 100 }],
      [{ code: 100 }],
    ]);
    const flow = new BankConnectFlow(fakeApi().api, fetchFn);
    await flow.acceptConsent();
    flow.selectBank(banamex);
    const pending = flow.submitCredentials({ username: 'ana', password: 'x' });
    await reach(flow, 'connecting');
    flow.cancel();
    await pending;
    assert.equal(stepOf(flow).name, 'connecting');
  });

  it('does not link twice after a partial failure', async () => {
    let fail = true;
    const { api, calls } = fakeApi({
      linkAccount: async (id) => {
        calls.push(['link', id]);
        if (id === 'la-debit' && fail) {
          fail = false;
          throw new Error('network');
        }
      },
    });
    const flow = new BankConnectFlow(api, syncfy([[{ code: 200 }]]).fetchFn);
    await flow.acceptConsent();
    flow.selectBank(banamex);
    await flow.submitCredentials({ username: 'ana', password: 'x' });
    const choices = { 'la-card': 'create', 'la-debit': 'create' } as const;

    await flow.linkAccounts(choices);
    const retry = stepOf(flow);
    assert.equal(retry.name, 'linkAccounts');
    assert.equal(
      retry.name === 'linkAccounts' &&
        retry.bank.accounts.find((a) => a.id === 'la-card')?.accountId,
      'new',
    );

    await flow.linkAccounts(choices);
    assert.equal(stepOf(flow).name, 'done');
    const step = stepOf(flow);
    assert.equal(step.name === 'done' && step.linked, 2);
    assert.deepEqual(
      calls.filter((c) => c[0] === 'link').map((c) => c[1]),
      ['la-card', 'la-debit', 'la-debit'],
    );
  });

  it('ends the wait for a second factor when cancelled', async () => {
    const { fetchFn } = syncfy([
      [
        {
          code: 410,
          twofa: [{ name: 'token', type: 'text', label: 'Código' }],
        },
      ],
    ]);
    const flow = new BankConnectFlow(fakeApi().api, fetchFn);
    await flow.acceptConsent();
    flow.selectBank(banamex);
    const pending = flow.submitCredentials({ username: 'ana', password: 'x' });
    await reach(flow, 'twofa');
    flow.cancel();
    await pending; // resolves instead of hanging
    assert.equal(stepOf(flow).name, 'twofa');
  });
});
