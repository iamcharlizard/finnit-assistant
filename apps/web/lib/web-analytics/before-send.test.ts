import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { redactAnalyticsEvent } from './before-send';

const view = (url: string) => redactAnalyticsEvent({ type: 'pageview', url });

describe('redactAnalyticsEvent', () => {
  it('drops the query string from app pages', () => {
    assert.equal(
      view('https://finnit.app/history?month=2026-11&q=uber')?.url,
      'https://finnit.app/history',
    );
    assert.equal(
      view('https://finnit.app/login?next=%2Fdebts')?.url,
      'https://finnit.app/login',
    );
  });

  it('keeps campaign tags on the landing only', () => {
    assert.equal(
      view('https://finnit.app/?utm_source=ig&utm_campaign=launch&email=a@b.c')
        ?.url,
      'https://finnit.app/?utm_source=ig&utm_campaign=launch',
    );
    assert.equal(
      view('https://finnit.app/?ref=tw')?.url,
      'https://finnit.app/?ref=tw',
    );
  });

  it('does not count admin screens', () => {
    assert.equal(view('https://finnit.app/admin'), null);
    assert.equal(view('https://finnit.app/admin/waitlist?x=1'), null);
    assert.notEqual(view('https://finnit.app/administrative'), null);
  });

  it('ignores malformed urls', () => {
    assert.equal(view('not a url'), null);
  });
});
