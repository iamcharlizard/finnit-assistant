import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/** PBKDF2 hash stored as `salt:hash`. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

/** Checks a password against a PBKDF2 (`salt:hash`) or legacy bcrypt hash. */
export async function verifyPassword(
  password: string,
  storedHash: string | null,
): Promise<boolean> {
  if (!storedHash) return false;
  if (!storedHash.includes(':')) {
    return bcrypt.compare(password, storedHash).catch(() => false);
  }
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const testHash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(testHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Minimum length for passwords assigned by an admin or the master command. */
export const MIN_PASSWORD_LENGTH = 10;
