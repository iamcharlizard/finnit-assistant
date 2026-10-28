import { OcrClient, OcrRejectedError, OcrUnavailableError } from './ocr.client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const imageBody = {
  width: 800,
  height: 1600,
  lines: [
    {
      text: 'TIENDA DEMO',
      confidence: 0.98,
      box: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    },
    { text: 42, confidence: 0.5 },
    { text: 'TOTAL 120.00', confidence: 0.91, box: [] },
  ],
  qr: [{ text: 'https://example.test', format: 'QRCode' }, { nope: true }],
  timingsMs: { ocr: 10 },
};

describe('OcrClient', () => {
  const original = { ...process.env };
  let fetchMock: jest.SpyInstance;
  let client: OcrClient;

  beforeEach(() => {
    process.env.OCR_SERVICE_URL = 'http://ocr.test:8090/';
    process.env.OCR_SERVICE_TOKEN = 'secret';
    fetchMock = jest.spyOn(global, 'fetch');
    client = new OcrClient();
    jest.spyOn(client['logger'], 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });

  it('is configured only with both URL and token', () => {
    expect(client.isConfigured).toBe(true);
    delete process.env.OCR_SERVICE_TOKEN;
    expect(client.isConfigured).toBe(false);
    process.env.OCR_SERVICE_TOKEN = 'secret';
    delete process.env.OCR_SERVICE_URL;
    expect(client.isConfigured).toBe(false);
  });

  it('throws OcrUnavailableError without calling anything when not configured', async () => {
    delete process.env.OCR_SERVICE_URL;
    await expect(client.image(Buffer.from('x'), 'image/jpeg')).rejects.toThrow(
      OcrUnavailableError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the image with the bearer token and keeps well-formed lines', async () => {
    fetchMock.mockResolvedValue(json(200, imageBody));
    const result = await client.image(Buffer.from([0xff, 0xd8]), 'image/jpeg');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://ocr.test:8090/v1/image');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer secret',
    );
    const file = (init.body as FormData).get('file') as File;
    expect(file.type).toBe('image/jpeg');
    expect(file.name).toBe('upload.jpg');

    expect(result.lines.map((l) => l.text)).toEqual([
      'TIENDA DEMO',
      'TOTAL 120.00',
    ]);
    expect(result.qr).toEqual([
      { text: 'https://example.test', format: 'QRCode' },
    ]);
    expect(result.width).toBe(800);
  });

  it('retries once on 5xx and then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(503, { error: 'busy', message: 'warming up' }),
      )
      .mockResolvedValueOnce(json(200, imageBody));
    const result = await client.image(Buffer.from('x'), 'image/png');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.lines).toHaveLength(2);
  });

  it('retries once on a network error, then reports unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(client.image(Buffer.from('x'), 'image/png')).rejects.toThrow(
      new OcrUnavailableError('The OCR service is unreachable'),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a timeout', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
    );
    await expect(client.image(Buffer.from('x'), 'image/png')).rejects.toThrow(
      'The OCR service timed out',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry 4xx: 413/415 are rejections, 401 is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(
      json(415, { error: 'unsupported', message: 'Unsupported file type' }),
    );
    const rejected = await client
      .image(Buffer.from('x'), 'image/png')
      .catch((e: unknown) => e);
    expect(rejected).toBeInstanceOf(OcrRejectedError);
    expect((rejected as OcrRejectedError).status).toBe(415);
    expect((rejected as Error).message).toBe('Unsupported file type');

    fetchMock.mockResolvedValueOnce(json(401, { error: 'unauthorized' }));
    await expect(client.image(Buffer.from('x'), 'image/png')).rejects.toThrow(
      OcrUnavailableError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a response without lines', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }));
    await expect(client.image(Buffer.from('x'), 'image/png')).rejects.toThrow(
      'Unexpected OCR response',
    );
  });

  it('sends PDFs with maxPages and numbers the pages', async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        pages: [
          {
            page: 1,
            width: 10,
            height: 10,
            lines: [{ text: 'A', confidence: 1, box: [] }],
            qr: [],
          },
          { width: 10, height: 10, lines: [], qr: [] },
        ],
        timingsMs: { total: 5 },
      }),
    );
    const result = await client.pdf(Buffer.from('%PDF-1.7'), 3);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://ocr.test:8090/v1/pdf');
    expect((init.body as FormData).get('maxPages')).toBe('3');
    expect(result.pages.map((p) => p.page)).toEqual([1, 2]);
    expect(result.pages[0].lines[0].text).toBe('A');
  });

  it('health is false when not configured or unreachable', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { status: 'ok' }));
    await expect(client.health()).resolves.toBe(true);
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(client.health()).resolves.toBe(false);
    delete process.env.OCR_SERVICE_TOKEN;
    await expect(client.health()).resolves.toBe(false);
  });
});
