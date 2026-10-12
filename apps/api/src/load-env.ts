import { existsSync } from 'node:fs';

// Imported first by main.ts so .env is loaded before any module reads
// process.env at import time (e.g. JwtModule.register). In containers the
// variables come from the environment and there is no .env file.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}
