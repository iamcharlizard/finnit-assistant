import { SyncfyClient, SyncfyError } from './syncfy.client';

const KEY = 'secret-api-key';

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
const ok = (response: unknown) => json({ code: 200, status: true, response });

type FetchMock = jest.Mock<Promise<Response>, Parameters<typeof fetch>>;

describe('SyncfyClient', () => {
  let fetchMock: FetchMock;
  let sleep: jest.Mock<Promise<void>, [number]>;
  let client: SyncfyClient;

  beforeEach(() => {
    fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
    sleep = jest.fn<Promise<void>, [number]>().mockResolvedValue();
    client = new SyncfyClient(KEY, fetchMock, sleep);
  });

  const url = (call = 0) => fetchMock.mock.calls[call][0] as string;
  const init = (call = 0) => fetchMock.mock.calls[call][1]!;

  it('sends the API key in the query for GET and in the body for POST', async () => {
    fetchMock
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({ token: 't-1' }));

    await client.listUsers();
    const token = await client.createSession('user-1');

    expect(url(0)).toBe(`https://api.syncfy.com/v1/users?api_key=${KEY}`);
    expect(JSON.parse(init(1).body as string)).toEqual({
      id_user: 'user-1',
      api_key: KEY,
    });
    expect(token).toBe('t-1');
  });

  it('uses the session token as a bearer header, never the API key', async () => {
    fetchMock.mockResolvedValueOnce(ok([]));
    await client.listCredentials('session-token');
    expect(url()).not.toContain(KEY);
    expect((init().headers as Record<string, string>).authorization).toBe(
      'Bearer session-token',
    );
  });

  it('pages through transactions with filters', async () => {
    const page = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id_transaction: `t${i}` }));
    fetchMock
      .mockResolvedValueOnce(ok(page(200)))
      .mockResolvedValueOnce(ok(page(3)));

    const result = await client.listTransactions('tok', 'acc-1', {
      refreshedSince: new Date('2026-10-01T00:00:00Z'),
    });

    expect(result).toHaveLength(203);
    expect(url(0)).toContain('id_account=acc-1');
    expect(url(0)).toContain(`dt_refresh_from=${Date.UTC(2026, 9, 1) / 1000}`);
    expect(url(0)).toContain('limit=200&skip=0');
    expect(url(1)).toContain('skip=200');
  });

  it('retries rate limits and server errors with backoff', async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(ok([]));

    await expect(client.listUsers()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 1000]);
  });

  it('gives up after three attempts', async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    await expect(client.listUsers()).rejects.toThrow(SyncfyError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry client errors and never leaks the key or ids', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: `bad key ${KEY}` }, 401));
    const error = (await client
      .requestRefresh('tok', '6acdb38a4a8bc83ccd1fcbdf')
      .catch((e: unknown) => e)) as SyncfyError;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error.status).toBe(401);
    expect(error.message).toBe(
      'Syncfy PUT /credentials/:id/pulls failed with HTTP 401: bad key ***',
    );
  });

  it('is not configured without a key', async () => {
    const unconfigured = new SyncfyClient('', fetchMock, sleep);
    expect(unconfigured.isConfigured).toBe(false);
    await expect(unconfigured.listUsers()).rejects.toThrow(
      'SYNCFY_API_KEY is not set',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
