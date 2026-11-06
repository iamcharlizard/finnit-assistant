import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { avatarSrc } from './avatar';
import { centerSquare, isAcceptedPhoto, MAX_PHOTO_BYTES } from './photo';

describe('avatarSrc', () => {
  it('serves an uploaded photo through the proxy, versioned', () => {
    assert.equal(
      avatarSrc({ source: 'uploaded', url: null, version: '1730000000000' }),
      '/api/files/me/avatar?v=1730000000000',
    );
  });

  it('uses the Google picture, or nothing (initials)', () => {
    const url = 'https://lh3.googleusercontent.com/a/x';
    assert.equal(avatarSrc({ source: 'google', url, version: '1' }), url);
    assert.equal(avatarSrc(null), null);
    assert.equal(avatarSrc(undefined), null);
  });
});

describe('profile photo', () => {
  it('crops the centered square', () => {
    assert.deepEqual(centerSquare(4000, 3000), { x: 500, y: 0, side: 3000 });
    assert.deepEqual(centerSquare(1080, 1920), { x: 0, y: 420, side: 1080 });
    assert.deepEqual(centerSquare(300, 300), { x: 0, y: 0, side: 300 });
  });

  it('takes JPEG, PNG or WEBP photos of a sane size', () => {
    assert.ok(isAcceptedPhoto({ type: 'image/jpeg', size: 3_000_000 }));
    assert.ok(isAcceptedPhoto({ type: 'IMAGE/PNG', size: 10 }));
    assert.ok(!isAcceptedPhoto({ type: 'image/heic', size: 10 }));
    assert.ok(!isAcceptedPhoto({ type: 'application/pdf', size: 10 }));
    assert.ok(!isAcceptedPhoto({ type: 'image/webp', size: 0 }));
    assert.ok(
      !isAcceptedPhoto({ type: 'image/webp', size: MAX_PHOTO_BYTES + 1 }),
    );
  });
});
