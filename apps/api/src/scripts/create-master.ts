/**
 * Creates the master admin (or makes an existing user the master).
 *
 *   Local:     pnpm --filter @finnit/api create-master --email you@example.com --name "Your name"
 *   Container: node apps/api/dist/scripts/create-master.js --email you@example.com --name "Your name"
 *
 * The password comes from MASTER_PASSWORD or is asked for without echo;
 * never as an argument (it would stay in the shell history).
 * --replace hands the master role over to this user. Running it again for
 * the master with a password resets that password.
 */
import '../load-env';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@finnit/database';
import { MasterUserError, setMasterUser } from '../modules/admin/master-user';

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // Print the question, then stop echoing what is typed.
    process.stdout.write(question);
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput =
      () => undefined;
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      replace: { type: 'boolean', default: false },
      'no-password': { type: 'boolean', default: false },
    },
  });
  if (!values.email) {
    console.error(
      'Usage: create-master --email <email> [--name "<name>"] [--replace] [--no-password]',
    );
    process.exit(1);
  }

  let password = process.env.MASTER_PASSWORD;
  if (!password && !values['no-password'] && process.stdin.isTTY) {
    password = await askHidden(
      'Password (leave empty to keep the current one): ',
    );
    if (password) {
      const again = await askHidden('Repeat the password: ');
      if (again !== password) {
        console.error('The passwords do not match.');
        process.exit(1);
      }
    }
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const result = await setMasterUser(prisma, {
      email: values.email,
      name: values.name,
      password: password || undefined,
      replace: values.replace,
    });
    console.log(
      result.created
        ? `Master admin created: ${values.email}`
        : `${values.email} is now the master admin`,
    );
  } catch (error) {
    if (error instanceof MasterUserError) {
      console.error(error.message);
      process.exitCode = 1;
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
