import { UserRole, type PrismaClient } from '@finnit/database';
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
} from '../../common/utils/password.util';
import { createDefaultCategories } from '../auth/default-categories';

export interface MasterUserOptions {
  email: string;
  name?: string;
  /** Required to create the user; optional when promoting an existing one. */
  password?: string;
  /** Hand the master role over from the current master to this user. */
  replace?: boolean;
}

export class MasterUserError extends Error {}

/**
 * Creates the master admin, or makes an existing user the master. Run once
 * per environment (scripts/create-master). Also the way back in if the
 * master loses access: pass a new password.
 */
export async function setMasterUser(
  prisma: PrismaClient,
  options: MasterUserOptions,
): Promise<{ id: string; created: boolean }> {
  const email = options.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new MasterUserError('Invalid email');
  }
  if (options.password !== undefined) {
    if (options.password.length < MIN_PASSWORD_LENGTH) {
      throw new MasterUserError(
        `The password needs at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findFirst({ where: { isMaster: true } });
    const user = await tx.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (current && current.id !== user?.id) {
      if (!options.replace) {
        throw new MasterUserError(
          `${current.email} is already the master. Use --replace to hand the role over.`,
        );
      }
      // The previous master stays an admin.
      await tx.user.update({
        where: { id: current.id },
        data: { isMaster: false },
      });
    }

    const passwordData = options.password
      ? {
          passwordHash: hashPassword(options.password),
          tokenVersion: { increment: 1 },
        }
      : {};

    if (user) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          role: UserRole.admin,
          isMaster: true,
          disabledAt: null,
          ...(options.name?.trim() && { name: options.name.trim() }),
          ...passwordData,
        },
      });
      return { id: user.id, created: false };
    }

    if (!options.password) {
      throw new MasterUserError('A new master user needs a password');
    }
    const created = await tx.user.create({
      data: {
        email,
        name: options.name?.trim() || email.split('@')[0],
        passwordHash: hashPassword(options.password),
        role: UserRole.admin,
        isMaster: true,
      },
    });
    await createDefaultCategories(tx, created.id);
    return { id: created.id, created: true };
  });
}
