import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Prisma, UserRole, type User as UserRow } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { verifyPassword } from '../../common/utils/password.util';
import { Actor, AdminUsersService } from './admin-users.service';
import { UserStatus } from './dto/admin-user.dto';

const userRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  passwordHash: null,
  role: UserRole.user,
  isMaster: false,
  googleSubject: null,
  disabledAt: null,
  lastLoginAt: null,
  tokenVersion: 0,
  locale: 'es',
  invitedById: 'admin-1',
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
  ...overrides,
});

const withInviter = (user: UserRow) => ({
  ...user,
  invitedBy: { name: 'Admin' },
});

const master: Actor = { id: 'master-1', role: UserRole.admin, isMaster: true };
const admin: Actor = { id: 'admin-1', role: UserRole.admin, isMaster: false };

describe('AdminUsersService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: AdminUsersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    prisma.$transaction.mockImplementation(
      (fn: unknown) => (fn as (tx: unknown) => unknown)(prisma) as never,
    );
    prisma.user.update.mockImplementation(
      (args) =>
        Promise.resolve(
          withInviter(
            userRow({ id: args.where.id, ...(args.data as Partial<UserRow>) }),
          ),
        ) as never,
    );
    prisma.category.create.mockResolvedValue({ id: 'cat-1' } as never);
    service = new AdminUsersService(prisma);
  });

  describe('list', () => {
    beforeEach(() => {
      prisma.user.count.mockResolvedValue(3);
    });

    it('filters by search, status and role', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.list({
        search: '  ada ',
        status: UserStatus.disabled,
        role: UserRole.admin,
      });

      const where = {
        OR: [
          { name: { contains: 'ada', mode: 'insensitive' } },
          { email: { contains: 'ada', mode: 'insensitive' } },
        ],
        disabledAt: { not: null },
        role: UserRole.admin,
      };
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      expect(prisma.user.count).toHaveBeenCalledWith({ where });
    });

    it('filters active users', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.list({ status: UserStatus.active });

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { disabledAt: null },
      });
    });

    it('fetches first + 1 rows to know if there is a next page', async () => {
      prisma.user.findMany.mockResolvedValue(
        ['u1', 'u2', 'u3'].map((id) => withInviter(userRow({ id }))),
      );

      const page = await service.list({ first: 2 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
      expect(page.edges.map((e) => e.cursor)).toEqual(['u1', 'u2']);
      expect(page.pageInfo).toEqual({
        startCursor: 'u1',
        endCursor: 'u2',
        hasNextPage: true,
        hasPreviousPage: false,
      });
      expect(page.totalCount).toBe(3);
    });

    it('starts after the cursor and reports the last page', async () => {
      prisma.user.findMany.mockResolvedValue([
        withInviter(userRow({ id: 'u3' })),
      ] as never);

      const page = await service.list({ first: 2, after: 'u2' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: 'u2' }, skip: 1, take: 3 }),
      );
      expect(page.pageInfo.hasNextPage).toBe(false);
      expect(page.pageInfo.hasPreviousPage).toBe(true);
    });

    it('maps rows to admin users without secrets', async () => {
      prisma.user.findMany.mockResolvedValue([
        withInviter(
          userRow({
            passwordHash: 'salt:hash',
            googleSubject: 'google-sub',
            disabledAt: new Date('2026-10-05'),
          }),
        ),
      ] as never);

      const { edges } = await service.list({});

      expect(edges[0].node).toEqual({
        id: 'user-1',
        name: 'Ada',
        email: 'ada@example.com',
        role: UserRole.user,
        isMaster: false,
        status: UserStatus.disabled,
        hasPassword: true,
        hasGoogle: true,
        lastLoginAt: undefined,
        disabledAt: new Date('2026-10-05'),
        invitedByName: 'Admin',
        createdAt: new Date('2026-10-01'),
      });
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(
        (args) =>
          Promise.resolve(
            withInviter(
              userRow({ id: 'new-user', ...(args.data as Partial<UserRow>) }),
            ),
          ) as never,
      );
    });

    it('creates a user with a lowercased email and the inviter', async () => {
      const result = await service.create(admin, {
        name: '  Grace ',
        email: ' Grace@Example.COM ',
        password: 'a-long-password',
      });

      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        name: 'Grace',
        email: 'grace@example.com',
        role: UserRole.user,
        invitedById: 'admin-1',
      });
      await expect(
        verifyPassword('a-long-password', data.passwordHash as string),
      ).resolves.toBe(true);
      expect(result).toMatchObject({
        id: 'new-user',
        email: 'grace@example.com',
        hasPassword: true,
        status: UserStatus.active,
      });
    });

    it('a password is optional (Google only)', async () => {
      const result = await service.create(admin, {
        name: 'Grace',
        email: 'grace@example.com',
      });

      expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
        passwordHash: null,
      });
      expect(result.hasPassword).toBe(false);
    });

    it('creates the default categories inside the transaction', async () => {
      const tx = mockDeep<PrismaService>();
      tx.user.create.mockResolvedValue(
        withInviter(userRow({ id: 'new-user' })),
      );
      tx.category.create.mockResolvedValue({ id: 'cat-1' } as never);
      prisma.$transaction.mockImplementation(
        (fn: unknown) => (fn as (tx: unknown) => unknown)(tx) as never,
      );

      await service.create(admin, { name: 'Grace', email: 'g@example.com' });

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.category.create).not.toHaveBeenCalled();
      expect(tx.user.create).toHaveBeenCalled();
      expect(tx.category.create).toHaveBeenCalled();
      expect(
        tx.category.create.mock.calls.every(
          ([args]) => args.data.userId === 'new-user',
        ),
      ).toBe(true);
    });

    it('rejects a duplicate email, case-insensitively', async () => {
      prisma.user.findFirst.mockResolvedValue(userRow());

      await expect(
        service.create(admin, { name: 'Ada', email: 'ADA@example.com' }),
      ).rejects.toThrow(ConflictError);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'ada@example.com', mode: 'insensitive' } },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('maps a concurrent duplicate (P2002) to ConflictError', async () => {
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create(admin, { name: 'Grace', email: 'grace@example.com' }),
      ).rejects.toThrow(ConflictError);
    });

    it('lets other database errors through', async () => {
      prisma.user.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.create(admin, { name: 'Grace', email: 'grace@example.com' }),
      ).rejects.toThrow('db down');
    });

    it('only the master creates admins', async () => {
      await expect(
        service.create(admin, {
          name: 'Grace',
          email: 'grace@example.com',
          role: UserRole.admin,
        }),
      ).rejects.toThrow(ForbiddenError);
      expect(prisma.user.create).not.toHaveBeenCalled();

      await service.create(master, {
        name: 'Grace',
        email: 'grace@example.com',
        role: UserRole.admin,
      });
      expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
        role: UserRole.admin,
        invitedById: 'master-1',
      });
    });
  });

  describe('update', () => {
    it('lets an admin rename a user', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());

      await service.update(admin, 'user-1', { name: ' Ada L. ' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { name: 'Ada L.' },
        }),
      );
    });

    it('only the master changes roles', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());

      await expect(
        service.update(admin, 'user-1', { role: UserRole.admin }),
      ).rejects.toThrow(ForbiddenError);
      expect(prisma.user.update).not.toHaveBeenCalled();

      await service.update(master, 'user-1', { role: UserRole.admin });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { role: UserRole.admin } }),
      );
    });

    it('sending the same role is not a role change', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());

      await expect(
        service.update(admin, 'user-1', { role: UserRole.user, name: 'Ada' }),
      ).resolves.toBeDefined();
    });

    it('the master is never demoted', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ id: 'master-1', role: UserRole.admin, isMaster: true }),
      );

      await expect(
        service.update(master, 'master-1', { role: UserRole.user }),
      ).rejects.toThrow(ForbiddenError);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('only the master edits the master', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ id: 'master-1', role: UserRole.admin, isMaster: true }),
      );

      await expect(
        service.update(admin, 'master-1', { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenError);

      await service.update(master, 'master-1', { name: 'Boss' });
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update(admin, 'gone', { name: 'X' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('who can change whom', () => {
    const otherAdmin = () =>
      userRow({ id: 'admin-2', role: UserRole.admin, name: 'Grace' });

    it.each([
      [
        'setPassword',
        (actor: Actor) =>
          service.setPassword(actor, 'admin-2', 'a-long-password'),
      ],
      ['disable', (actor: Actor) => service.disable(actor, 'admin-2')],
      [
        'unlinkGoogle',
        (actor: Actor) => service.unlinkGoogle(actor, 'admin-2'),
      ],
      [
        'update',
        (actor: Actor) => service.update(actor, 'admin-2', { name: 'X' }),
      ],
    ])("a non-master admin can't %s another admin", async (_action, act) => {
      prisma.user.findUnique.mockResolvedValue(otherAdmin());

      await expect(act(admin)).rejects.toThrow(ForbiddenError);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it.each([
      [
        'setPassword',
        (actor: Actor) =>
          service.setPassword(actor, 'admin-2', 'a-long-password'),
      ],
      ['disable', (actor: Actor) => service.disable(actor, 'admin-2')],
      [
        'unlinkGoogle',
        (actor: Actor) => service.unlinkGoogle(actor, 'admin-2'),
      ],
    ])('the master can %s another admin', async (_action, act) => {
      prisma.user.findUnique.mockResolvedValue(otherAdmin());

      await expect(act(master)).resolves.toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'admin-2' } }),
      );
    });

    it('a non-master admin can act on a regular user', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());

      await service.setPassword(admin, 'user-1', 'a-long-password');
      await service.disable(admin, 'user-1');

      expect(prisma.user.update).toHaveBeenCalledTimes(2);
    });

    it('an admin can change their own account', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ id: 'admin-1', role: UserRole.admin }),
      );

      await service.setPassword(admin, 'admin-1', 'a-long-password');
      await service.update(admin, 'admin-1', { name: 'Me' });

      expect(prisma.user.update).toHaveBeenCalledTimes(2);
      expect(prisma.user.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'admin-1' },
          data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
        }),
      );
    });

    it("an admin still can't promote or demote themselves", async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ id: 'admin-1', role: UserRole.admin }),
      );

      await expect(
        service.update(admin, 'admin-1', { role: UserRole.user }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('setPassword', () => {
    it('hashes the password and ends open sessions', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());

      await service.setPassword(admin, 'user-1', 'a-long-password');

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.tokenVersion).toEqual({ increment: 1 });
      await expect(
        verifyPassword('a-long-password', data.passwordHash as string),
      ).resolves.toBe(true);
    });

    it("an admin can't change the master's password", async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ id: 'master-1', isMaster: true }),
      );

      await expect(
        service.setPassword(admin, 'master-1', 'a-long-password'),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('removePassword', () => {
    it('requires a linked Google account', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ passwordHash: 'salt:hash' }),
      );

      await expect(service.removePassword(admin, 'user-1')).rejects.toThrow(
        ValidationError,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('removes it and ends open sessions when Google is linked', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ passwordHash: 'salt:hash', googleSubject: 'google-sub' }),
      );

      await service.removePassword(admin, 'user-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { passwordHash: null, tokenVersion: { increment: 1 } },
        }),
      );
    });
  });

  describe('unlinkGoogle', () => {
    it('clears the subject and ends open sessions', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ googleSubject: 'google-sub' }),
      );

      await service.unlinkGoogle(admin, 'user-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { googleSubject: null, tokenVersion: { increment: 1 } },
        }),
      );
    });
  });

  describe('disable and enable', () => {
    it('disables a user and ends open sessions', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());

      const result = await service.disable(admin, 'user-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: {
            disabledAt: expect.any(Date),
            tokenVersion: { increment: 1 },
          },
        }),
      );
      expect(result.status).toBe(UserStatus.disabled);
    });

    it('never disables the master, not even the master themself', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ id: 'master-1', isMaster: true }),
      );

      await expect(service.disable(master, 'master-1')).rejects.toThrow(
        ForbiddenError,
      );
      await expect(service.disable(admin, 'master-1')).rejects.toThrow(
        ForbiddenError,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("admins can't disable themselves", async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ id: 'admin-1', role: UserRole.admin }),
      );

      await expect(service.disable(admin, 'admin-1')).rejects.toThrow(
        new ForbiddenError('You cannot disable yourself'),
      );
    });

    it('disabling an already disabled user changes nothing', async () => {
      const disabledAt = new Date('2026-10-05');
      prisma.user.findUnique.mockResolvedValue(userRow({ disabledAt }));
      prisma.user.findUniqueOrThrow.mockResolvedValue(
        withInviter(userRow({ disabledAt })),
      );

      const result = await service.disable(admin, 'user-1');

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.disabledAt).toEqual(disabledAt);
    });

    it('enables a user', async () => {
      prisma.user.findUnique.mockResolvedValue(
        userRow({ disabledAt: new Date() }),
      );

      const result = await service.enable(admin, 'user-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { disabledAt: null } }),
      );
      expect(result.status).toBe(UserStatus.active);
    });
  });
});
