import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  ONBOARDING_VERSION,
  onboardingDecision,
} from '@finnit/core/onboarding/eligibility';
import {
  cardPlacement,
  inside,
  spotlightRect,
} from '@finnit/core/onboarding/tour';

describe('onboardingDecision', () => {
  it('shows it on a device that never did, whatever the account', () => {
    assert.equal(onboardingDecision({ stored: null }), 'show');
  });

  it('does nothing once the current version was seen', () => {
    assert.equal(onboardingDecision({ stored: ONBOARDING_VERSION }), 'none');
  });

  it('shows a newer version to anyone who saw an older one', () => {
    assert.equal(onboardingDecision({ stored: 'v0' }), 'show');
  });
});

describe('tour geometry', () => {
  const screen = { width: 390, height: 844 };

  it('pads the hole and keeps it on screen', () => {
    const hole = spotlightRect(
      { x: 4, y: 100, width: 200, height: 80 },
      screen,
    );
    assert.deepEqual(
      { x: hole.x, y: hole.y, width: hole.width, height: hole.height },
      { x: 0, y: 92, width: 212, height: 96 },
    );
    assert.equal(hole.radius, 16);
  });

  it('gives round elements a round hole', () => {
    const hole = spotlightRect(
      { x: 100, y: 700, width: 56, height: 56 },
      screen,
    );
    assert.equal(hole.radius, 36);
  });

  it('puts the card below the hole when it fits', () => {
    const placement = cardPlacement({
      hole: { x: 0, y: 100, width: 390, height: 120 },
      cardHeight: 180,
      screenHeight: 844,
      insets: { top: 47, bottom: 34 },
    });
    assert.deepEqual(placement, { side: 'below', top: 232 });
  });

  it('puts it above an element near the bottom (the bar)', () => {
    const placement = cardPlacement({
      hole: { x: 160, y: 720, width: 72, height: 72 },
      cardHeight: 180,
      screenHeight: 844,
      insets: { top: 47, bottom: 34 },
    });
    assert.deepEqual(placement, { side: 'above', top: 528 });
  });

  it('centers it without a target', () => {
    const placement = cardPlacement({
      hole: null,
      cardHeight: 200,
      screenHeight: 844,
      insets: { top: 47, bottom: 34 },
    });
    assert.deepEqual(placement, { side: 'center', top: 322 });
  });

  it('knows when a tap is inside the hole', () => {
    const rect = { x: 10, y: 10, width: 50, height: 50 };
    assert.equal(inside(rect, 30, 30), true);
    assert.equal(inside(rect, 70, 30), false);
  });
});
