import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  MAX_REQUEST_BYTES,
  PayloadTooLargeError,
  exceedsRequestLimit,
  limitStream,
  matchFileRoute,
} from './routes';
import { fitWithin, jpegName, shouldCompress } from './compress-image';

const ID = '3f2b8c1e-9a4d-4f6b-8e2a-1c5d7e9f0a1b';

describe('matchFileRoute', () => {
  it('forwards the whitelisted uploads', () => {
    assert.deepEqual(matchFileRoute('POST', ['statements']), {
      kind: 'upload',
      upstreamPath: '/statements',
    });
    assert.deepEqual(matchFileRoute('POST', ['receipts']), {
      kind: 'upload',
      upstreamPath: '/receipts',
    });
    assert.deepEqual(
      matchFileRoute('POST', ['transactions', ID, 'attachments']),
      { kind: 'upload', upstreamPath: `/transactions/${ID}/attachments` },
    );
  });

  it('forwards downloads of each kind by id', () => {
    for (const kind of ['statements', 'attachments', 'receipts']) {
      assert.deepEqual(matchFileRoute('GET', [kind, ID, 'file']), {
        kind: 'download',
        upstreamPath: `/${kind}/${ID}/file`,
      });
    }
    assert.equal(
      matchFileRoute('GET', ['statements', ID.toUpperCase(), 'file'])
        ?.upstreamPath,
      `/statements/${ID}/file`,
    );
  });

  it('rejects everything else', () => {
    const rejected: [string, string[]][] = [
      ['GET', ['statements']],
      ['POST', ['statements', ID, 'file']],
      ['GET', ['transactions', ID, 'attachments']],
      ['DELETE', ['statements', ID, 'file']],
      ['PUT', ['statements']],
      ['GET', ['statements', 'not-a-uuid', 'file']],
      ['GET', ['statements', '..', 'file']],
      ['GET', ['statements', `${ID}/../x`, 'file']],
      ['GET', ['statements', `${ID}?x=1`, 'file']],
      ['GET', ['statements', ID, 'file', 'extra']],
      ['GET', ['users', ID, 'file']],
      ['POST', ['transactions', 'abc', 'attachments']],
      ['POST', ['graphql']],
      ['POST', []],
      ['GET', ['__proto__', ID, 'file']],
    ];
    for (const [method, path] of rejected) {
      assert.equal(matchFileRoute(method, path), null, `${method} ${path}`);
    }
  });
});

describe('upload size', () => {
  it('rejects a declared length over the limit before reading', () => {
    assert.ok(!exceedsRequestLimit(null));
    assert.ok(!exceedsRequestLimit('1024'));
    assert.ok(!exceedsRequestLimit(String(MAX_REQUEST_BYTES)));
    assert.ok(exceedsRequestLimit(String(MAX_REQUEST_BYTES + 1)));
    assert.ok(exceedsRequestLimit('abc'));
    assert.ok(exceedsRequestLimit('-1'));
  });

  it('stops a streamed body once it passes the limit', async () => {
    const body = (chunks: number[]) =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const size of chunks) controller.enqueue(new Uint8Array(size));
          controller.close();
        },
      });
    const read = async (stream: ReadableStream<Uint8Array>) => {
      const reader = stream.getReader();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return total;
        total += value.byteLength;
      }
    };
    assert.equal(await read(limitStream(body([4, 4]), 10)), 8);
    await assert.rejects(
      read(limitStream(body([6, 6]), 10)),
      PayloadTooLargeError,
    );
  });
});

describe('image compression before upload', () => {
  it('only shrinks large, browser-decodable images', () => {
    const mb = 1024 * 1024;
    assert.equal(shouldCompress({ type: 'image/jpeg', size: 3 * mb }), true);
    assert.equal(shouldCompress({ type: 'image/png', size: 5 * mb }), true);
    assert.equal(shouldCompress({ type: 'image/jpeg', size: 1 * mb }), false);
    assert.equal(shouldCompress({ type: 'image/heic', size: 4 * mb }), false);
    assert.equal(
      shouldCompress({ type: 'application/pdf', size: 4 * mb }),
      false,
    );
  });

  it('fits the longest side within the limit, keeping the ratio', () => {
    assert.deepEqual(fitWithin(4032, 3024, 2000), {
      width: 2000,
      height: 1500,
    });
    assert.deepEqual(fitWithin(3024, 4032, 2000), {
      width: 1500,
      height: 2000,
    });
    assert.deepEqual(fitWithin(800, 600, 2000), { width: 800, height: 600 });
  });

  it('renames the file to .jpg', () => {
    assert.equal(jpegName('IMG_1234.PNG'), 'IMG_1234.jpg');
    assert.equal(jpegName('ticket'), 'ticket.jpg');
    assert.equal(jpegName('.png'), 'photo.jpg');
  });
});
