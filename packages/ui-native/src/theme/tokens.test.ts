import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_THEMES } from '@finnit/core/theme/app-theme';

import {
  parseBlobs,
  renderTintsCss,
  renderTokensModule,
  resolveThemes,
  withTints,
} from './tokens-source';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const globals = read('../../../ui/src/styles/globals.css');
const themes = resolveThemes(globals);

describe('design tokens', () => {
  it('match the web (run `pnpm --filter @finnit/ui-native tokens` if not)', () => {
    assert.equal(read('./tokens.generated.ts'), renderTokensModule(themes));
    assert.equal(read('../styles/tints.css'), renderTintsCss(themes));
  });

  it('turn color/opacity into tint tokens', () => {
    const tokens = withTints(themes.finnit.light.tokens);
    assert.equal(tokens['--income-10'], 'rgba(0, 102, 136, 0.1)');
    // A translucent color keeps its own alpha: 0.85 × 50% = 0.425.
    assert.equal(tokens['--glass-50'], 'rgba(255, 255, 255, 0.425)');
  });

  it('cover the four palettes in light and dark with the same tokens', () => {
    const names = Object.keys(themes.finnit.light.tokens).sort();
    assert.ok(names.length > 40);
    for (const theme of APP_THEMES) {
      for (const scheme of ['light', 'dark'] as const) {
        assert.deepEqual(Object.keys(themes[theme][scheme].tokens).sort(), names);
        for (const value of Object.values(themes[theme][scheme].tokens)) {
          assert.ok(!value.includes('var('), `unresolved ${value}`);
        }
      }
    }
  });

  it('resolve the cascade like the browser', () => {
    assert.equal(themes.finnit.light.tokens['--card'], '#ffffff');
    assert.equal(themes.finnit.dark.tokens['--card'], '#1a1b22');
    assert.equal(themes.mono.dark.tokens['--primary'], '#f2f2f2');
    // Palettes never change money or chart colors.
    for (const theme of APP_THEMES) {
      assert.equal(themes[theme].light.tokens['--income'], '#006688');
      assert.equal(themes[theme].dark.tokens['--chart-1'], '#3987e5');
    }
  });

  it('only Glass draws background blobs', () => {
    assert.equal(themes.glass.light.blobs.length, 3);
    assert.equal(themes.glass.dark.blobs.length, 3);
    assert.equal(themes.finnit.light.blobs.length, 0);
    assert.deepEqual(
      parseBlobs('radial-gradient(50% 55% at 8% 10%, rgba(0, 245, 255, 0.32) 0%, rgba(0, 245, 255, 0) 70%)'),
      [{ rx: 0.5, ry: 0.55, cx: 0.08, cy: 0.1, color: 'rgb(0, 245, 255)', opacity: 0.32 }],
    );
  });
});
