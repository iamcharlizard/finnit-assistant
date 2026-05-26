import { defineConfig } from 'prisma/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load .env from this package directory (prisma CLI runs from packages/database/)
const envFile = join(process.cwd(), '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["'](.*)["']$/, '$1');
    }
  }
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
