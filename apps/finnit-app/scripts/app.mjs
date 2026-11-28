#!/usr/bin/env node
// Runs the app against an environment's API: the dev server, a debug build
// or a release build, on a simulator or a device.
//
//   pnpm start                         # dev server; asks the environment
//   pnpm ios                           # debug build; asks where and the environment
//   pnpm release                       # release build; asks where and the environment
//
// Options (whatever is missing is asked; without a terminal, start and ios
// take local and release fails):
//   --env local|testing|production     local = .env.local only (as Expo loads it);
//                                      testing / production = .env.testing /
//                                      .env.production, over .env.local
//   --device | --simulator             ios and release only
//   --onboarding                       dev only: the welcome slides and tour show
//                                      on every launch (EXPO_PUBLIC_RESET_ONBOARDING=1)
//
//   pnpm release --device --env production
//   pnpm ios --onboarding --env local
//
// EXPO_PUBLIC_* values are written into the JS bundle, so the dev server is
// started with --clear whenever the environment isn't local: a cached bundle
// would keep the other API's URL.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { fileURLToPath } from 'node:url';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENVS = ['local', 'testing', 'production'];
const COMMANDS = ['start', 'ios', 'release'];

function fail(message) {
  console.error(`\x1b[31m✗ ${message}\x1b[0m`);
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  // The comment at the top of this file.
  const { readFileSync } = await import('node:fs');
  const lines = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
  console.log(lines.slice(1, lines.findIndex((l) => l.startsWith('import'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n').trim());
  process.exit(0);
}
if (!COMMANDS.includes(command)) {
  fail(`Usage: app.mjs <${COMMANDS.join('|')}> [--env local|testing|production] [--device|--simulator] [--onboarding]`);
}

let env = null;
let target = null;
let onboarding = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--env') env = args[++i];
  else if (arg.startsWith('--env=')) env = arg.slice('--env='.length);
  else if (arg === '--device') target = 'device';
  else if (arg === '--simulator') target = 'simulator';
  else if (arg === '--onboarding') onboarding = true;
  else fail(`Unknown option: ${arg}`);
}
if (env !== null && !ENVS.includes(env)) fail(`--env must be one of: ${ENVS.join(', ')}`);
if (command === 'start' && target) fail('--device / --simulator are for ios and release');
if (command === 'release' && onboarding) fail('--onboarding is dev only (start or ios)');

/**
 * A list to pick from with the arrow keys (or j/k, or the option's number)
 * and Enter; the first option starts selected. Ctrl-C or Esc cancels.
 */
async function choose(question, options) {
  if (!process.stdin.isTTY) {
    // No one to ask (e.g. turbo): the dev commands take the first option,
    // a release build must be told.
    if (command !== 'release') return options[0].value;
    fail(`${question}: pass it as an option (--help)`);
  }
  const { stdin, stdout } = process;
  let index = 0;
  const draw = (first) => {
    // Back to the first option's line and redraw the list in place.
    if (!first) stdout.write(`\x1b[${options.length}A`);
    options.forEach((option, i) => {
      const line = i === index ? `\x1b[36m❯ ${option.label}\x1b[0m` : `  ${option.label}`;
      stdout.write(`\x1b[2K${line}\n`);
    });
  };
  stdout.write(`\n\x1b[1m${question}\x1b[0m \x1b[2m(↑/↓, Enter)\x1b[0m\n\x1b[?25l`);
  draw(true);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  try {
    return await new Promise((resolve) => {
      const onKey = (text, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
          stdout.write('\x1b[?25h');
          stdin.setRawMode(false);
          fail('Cancelled');
        }
        if (key.name === 'up' || key.name === 'k') index = (index - 1 + options.length) % options.length;
        else if (key.name === 'down' || key.name === 'j' || key.name === 'tab') index = (index + 1) % options.length;
        else if (/^[1-9]$/.test(text ?? '') && options[Number(text) - 1]) index = Number(text) - 1;
        else if (key.name === 'return' || key.name === 'enter') {
          stdin.off('keypress', onKey);
          resolve(options[index].value);
          return;
        } else return;
        draw(false);
      };
      stdin.on('keypress', onKey);
    });
  } finally {
    stdin.setRawMode(false);
    stdin.pause();
    stdout.write('\x1b[?25h');
  }
}

if (command !== 'start' && !target) {
  const places = [
    { value: 'simulator', label: 'Simulator' },
    { value: 'device', label: 'Device (connected iPhone)' },
  ];
  // A release build usually goes to the phone.
  if (command === 'release') places.reverse();
  target = await choose('Where?', places);
}
if (!env) {
  const options = [
    { value: 'local', label: 'local (.env.local)' },
    { value: 'testing', label: 'testing (.env.testing)' },
    { value: 'production', label: 'production (.env.production)' },
  ];
  // A release build usually goes to a real environment.
  if (command === 'release') options.push(options.shift());
  env = await choose('Which environment?', options);
}

const childEnv = { ...process.env };
if (env !== 'local') {
  const file = join(APP_DIR, `.env.${env}`);
  if (!existsSync(file)) fail(`Missing ${file} (copy .env.example)`);
  // Loaded before Expo: Expo never overwrites a variable already set, so
  // these win over .env.local, which still fills in anything not here.
  const before = process.env.EXPO_PUBLIC_GRAPHQL_URL;
  delete process.env.EXPO_PUBLIC_GRAPHQL_URL;
  process.loadEnvFile(file);
  // Without its own URL the build would quietly take .env.local's API.
  if (!process.env.EXPO_PUBLIC_GRAPHQL_URL) {
    fail(`${file} has no EXPO_PUBLIC_GRAPHQL_URL (the app reads only that one)`);
  }
  if (before && before !== process.env.EXPO_PUBLIC_GRAPHQL_URL) {
    console.warn(`! EXPO_PUBLIC_GRAPHQL_URL from your shell is replaced by ${file}'s`);
  }
  Object.assign(childEnv, process.env);
}
if (onboarding) childEnv.EXPO_PUBLIC_RESET_ONBOARDING = '1';

const expoArgs =
  command === 'start'
    ? ['start', ...(env !== 'local' || onboarding ? ['--clear'] : [])]
    : [
        'run:ios',
        ...(target === 'device' ? ['--device'] : []),
        ...(command === 'release' ? ['--configuration', 'Release'] : []),
      ];

const api = childEnv.EXPO_PUBLIC_GRAPHQL_URL ?? '(lib/api/config.ts default)';
console.log(`\n▸ expo ${expoArgs.join(' ')} · ${env} · API ${api}${onboarding ? ' · onboarding reset' : ''}\n`);

const expoCli = createRequire(join(APP_DIR, 'package.json')).resolve('expo/bin/cli');
const child = spawn(process.execPath, [expoCli, ...expoArgs], {
  cwd: APP_DIR,
  env: childEnv,
  stdio: 'inherit',
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
