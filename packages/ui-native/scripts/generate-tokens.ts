/**
 * Writes src/theme/tokens.generated.ts from the web's globals.css.
 * Run after changing packages/ui/src/styles/globals.css:
 *   pnpm --filter @finnit/ui-native tokens
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderTintsCss, renderTokensModule, resolveThemes } from '../src/theme/tokens-source';

const here = dirname(fileURLToPath(import.meta.url));
const globals = join(here, '../../ui/src/styles/globals.css');
const output = join(here, '../src/theme/tokens.generated.ts');

const themes = resolveThemes(readFileSync(globals, 'utf8'));
writeFileSync(output, renderTokensModule(themes));
writeFileSync(join(here, '../src/styles/tints.css'), renderTintsCss(themes));
console.log(`Wrote ${output} and tints.css`);
