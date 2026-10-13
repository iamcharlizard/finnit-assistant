import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@finnit/database';
import type { User as UserRow } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { hashPassword } from '../../common/utils/password.util';
import { createDefaultCategories } from '../auth/default-categories';
import {
  AdminUser,
  AdminUserConnection,
  AdminUsersArgs,
  CreateUserInput,
  UpdateUserInput,
  UserStatus,
} from './dto/admin-user.dto';

/** The admin acting; comes from the request (JwtStrategy). */
export type Actor = Pick<UserRow, 'id' | 'role' | 'isMaster'>;

type UserWithInviter = UserRow & { invitedBy: { name: string } | null };

/**
 * Who can use Finnit: there is no public sign-up, admins add each person.
 *
 * Rules:
 * - Only the master creates admins or changes roles.
 * - Nobody but the master can touch the master, and the master can't be
 *   demoted or disabled (recovery is the create-master command).
 * - Only the master can change other admins' accounts (password, Google,
 *   disable), so one admin can't take over another.
 * - Admins can't disable themselves. Users are disabled, never deleted.
 * - Disabling a user or changing their password ends their open sessions.
 */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(args: AdminUsersArgs): Promise<AdminUserConnection> {
    const search = args.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(args.status === UserStatus.active && { disabledAt: null }),
      ...(args.status === UserStatus.disabled && {
        disabledAt: { not: null },
      }),
      ...(args.role && { role: args.role }),
    };
    const first = args.first ?? 50;
    const [rows, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { invitedBy: { select: { name: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: first + 1,
        ...(args.after && { cursor: { id: args.after }, skip: 1 }),
      }),
      this.prisma.user.count({ where }),
    ]);
    const page = rows.slice(0, first);
    return {
      edges: page.map((row) => ({ node: toAdminUser(row), cursor: row.id })),
      pageInfo: {
        startCursor: page[0]?.id,
        endCursor: page[page.length - 1]?.id,
        hasNextPage: rows.length > first,
        hasPreviousPage: Boolean(args.after),
      },
      totalCount,
    };
  }

  async create(actor: Actor, input: CreateUserInput): Promise<AdminUser> {
    const role = input.role ?? UserRole.user;
    if (role === UserRole.admin) this.assertMaster(actor, 'create admins');
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing)
      throw new ConflictError('A user with this email already exists');

    const user = await this.prisma
      .$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: input.name.trim(),
            email,
            passwordHash: input.password ? hashPassword(input.password) : null,
            role,
            invitedById: actor.id,
          },
          include: { invitedBy: { select: { name: true } } },
        });
        await createDefaultCategories(tx, created.id);
        return created;
      })
      .catch((error: unknown) => {
        // Two admins adding the same email at once.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictError('A user with this email already exists');
        }
        throw error;
      });
    return toAdminUser(user);
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateUserInput,
  ): Promise<AdminUser> {
    const target = await this.findTarget(actor, id);
    if (input.role !== undefined && input.role !== target.role) {
      this.assertMaster(actor, 'change roles');
      if (target.isMaster) {
        throw new ForbiddenError('The master administrator stays an admin');
      }
    }
    return this.save(id, {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.role !== undefined && { role: input.role }),
    });
  }

  async setPassword(
    actor: Actor,
    id: string,
    password: string,
  ): Promise<AdminUser> {
    await this.findTarget(actor, id);
    return this.save(id, {
      passwordHash: hashPassword(password),
      tokenVersion: { increment: 1 },
    });
  }

  async removePassword(actor: Actor, id: string): Promise<AdminUser> {
    const target = await this.findTarget(actor, id);
    if (!target.googleSubject) {
      throw new ValidationError(
        'They have no Google account linked yet; without a password they could not sign in',
      );
    }
    return this.save(id, {
      passwordHash: null,
      tokenVersion: { increment: 1 },
    });
  }

  async unlinkGoogle(actor: Actor, id: string): Promise<AdminUser> {
    await this.findTarget(actor, id);
    // They can link again by signing in with a Google account of their email.
    return this.save(id, {
      googleSubject: null,
      tokenVersion: { increment: 1 },
    });
  }

  async disable(actor: Actor, id: string): Promise<AdminUser> {
    const target = await this.findTarget(actor, id);
    if (target.isMaster) {
      throw new ForbiddenError('The master administrator cannot be disabled');
    }
    if (target.id === actor.id) {
      throw new ForbiddenError('You cannot disable yourself');
    }
    if (target.disabledAt) return this.get(id);
    return this.save(id, {
      disabledAt: new Date(),
      tokenVersion: { increment: 1 },
    });
  }

  async enable(actor: Actor, id: string): Promise<AdminUser> {
    await this.findTarget(actor, id);
    return this.save(id, { disabledAt: null });
  }

  private async get(id: string): Promise<AdminUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { invitedBy: { select: { name: true } } },
    });
    return toAdminUser(user);
  }

  private async save(
    id: string,
    data: Prisma.UserUpdateInput,
  ): Promise<AdminUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: { invitedBy: { select: { name: true } } },
    });
    return toAdminUser(user);
  }

  /** The user to change; only the master may change the master. */
  private async findTarget(actor: Actor, id: string): Promise<UserRow> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundError('User not found');
    if (target.id === actor.id) return target;
    if (target.isMaster) {
      throw new ForbiddenError(
        'Only the master administrator can change their own account',
      );
    }
    if (target.role === UserRole.admin && !actor.isMaster) {
      throw new ForbiddenError(
        "Only the master administrator can change another admin's account",
      );
    }
    return target;
  }

  private assertMaster(actor: Actor, action: string) {
    if (!actor.isMaster) {
      throw new ForbiddenError(`Only the master administrator can ${action}`);
    }
  }
}

function toAdminUser(user: UserWithInviter): AdminUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isMaster: user.isMaster,
    status: user.disabledAt ? UserStatus.disabled : UserStatus.active,
    hasPassword: Boolean(user.passwordHash),
    hasGoogle: Boolean(user.googleSubject),
    lastLoginAt: user.lastLoginAt ?? undefined,
    disabledAt: user.disabledAt ?? undefined,
    invitedByName: user.invitedBy?.name,
    createdAt: user.createdAt,
  };
}
