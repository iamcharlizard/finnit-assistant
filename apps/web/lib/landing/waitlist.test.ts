import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { campaignSource, isCampaignSource, normalizeEmail } from './waitlist';

describe('waitlist rules', () => {
  it('normalizes valid emails and rejects the rest', () => {
    assert.equal(normalizeEmail('  Ada@Example.COM '), 'ada@example.com');
    assert.equal(normalizeEmail('ada@example'), null);
    assert.equal(normalizeEmail('no at sign'), null);
    assert.equal(normalizeEmail(undefined), null);
    assert.equal(normalizeEmail(`${'a'.repeat(250)}@x.co`), null);
  });

  it('takes the campaign from utm_source, then ref', () => {
    assert.equal(
      campaignSource({ utm_source: 'Instagram', ref: 'x' }),
      'instagram',
    );
    assert.equal(campaignSource({ ref: 'tw' }), 'tw');
    assert.equal(campaignSource({ utm_source: ['a', 'b'] }), 'a');
    assert.equal(campaignSource({ utm_source: '<script>' }), undefined);
    assert.equal(campaignSource({}), undefined);
  });

  it('accepts only plain campaign names', () => {
    assert.equal(isCampaignSource('ig-launch_1'), true);
    assert.equal(isCampaignSource('a b'), false);
    assert.equal(isCampaignSource(3), false);
  });
});
