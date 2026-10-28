import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  UserRole,
  type PrismaClient,
  type User as UserRow,
} from '@finnit/database';
import { MasterUserError, setMasterUser } from './master-user';
import { verifyPassword } from '../../common/utils/password.util';

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
  locale: 'es',
  tokenVersion: 0,
  invitedById: null,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
  ...overrides,
});

const PASSWORD = 'a-long-password';

describe('setMasterUser', () => {
  let prisma: DeepMockProxy<PrismaClient>;

  /** First findFirst: the current master; second: the user with that email. */
  function given(current: UserRow | null, byEmail: UserRow | null) {
    prisma.user.findFirst
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(byEmail);
  }

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    prisma.$transaction.mockImplementation(
      (fn: unknown) => (fn as (tx: unknown) => unknown)(prisma) as never,
    );
    prisma.user.create.mockImplementation(
      () => Promise.resolve(userRow({ id: 'new-master' })) as never,
    );
    prisma.category.create.mockResolvedValue({ id: 'cat-1' } as never);
  });

  it('creates a new master with a password and default categories', async () => {
    given(null, null);

    const result = await setMasterUser(prisma, {
      email: ' Ada@Example.com ',
      name: 'Ada',
      password: PASSWORD,
    });

    expect(result).toEqual({ id: 'new-master', created: true });
    expect(prisma.user.findFirst).toHaveBeenNthCalledWith(2, {
      where: { email: { equals: 'ada@example.com', mode: 'insensitive' } },
    });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: 'ada@example.com',
      name: 'Ada',
      role: UserRole.admin,
      isMaster: true,
    });
    await expect(
      verifyPassword(PASSWORD, data.passwordHash as string),
    ).resolves.toBe(true);
    expect(prisma.category.create).toHaveBeenCalled();
    expect(prisma.category.create.mock.calls[0][0].data).toMatchObject({
      userId: 'new-master',
    });
  });

  it('names a new master after the email when no name is given', async () => {
    given(null, null);

    await setMasterUser(prisma, {
      email: 'ada@example.com',
      password: PASSWORD,
    });

    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
      name: 'ada',
    });
  });

  it('promotes an existing user (and re-enables them)', async () => {
    const existing = userRow({ disabledAt: new Date() });
    given(null, existing);

    const result = await setMasterUser(prisma, { email: 'ada@example.com' });

    expect(result).toEqual({ id: 'user-1', created: false });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: UserRole.admin, isMaster: true, disabledAt: null },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('resets the master password and ends their sessions', async () => {
    const master = userRow({ role: UserRole.admin, isMaster: true });
    given(master, master);

    await setMasterUser(prisma, {
      email: 'ada@example.com',
      password: PASSWORD,
    });

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        isMaster: true,
        passwordHash: expect.any(String),
        tokenVersion: { increment: 1 },
      }),
    });
  });

  it('refuses when another user is already the master', async () => {
    given(
      userRow({ id: 'old', email: 'old@example.com', isMaster: true }),
      userRow(),
    );

    await expect(
      setMasterUser(prisma, { email: 'ada@example.com' }),
    ).rejects.toThrow(MasterUserError);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('hands the role over with replace; the old master stays an admin', async () => {
    given(
      userRow({
        id: 'old',
        email: 'old@example.com',
        role: UserRole.admin,
        isMaster: true,
      }),
      userRow(),
    );

    await setMasterUser(prisma, { email: 'ada@example.com', replace: true });

    expect(prisma.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'old' },
      data: { isMaster: false },
    });
    expect(prisma.user.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'user-1' },
      data: expect.objectContaining({ isMaster: true, role: UserRole.admin }),
    });
  });

  it('a new user without a password is an error', async () => {
    given(null, null);

    await expect(
      setMasterUser(prisma, { email: 'ada@example.com' }),
    ).rejects.toThrow(
      new MasterUserError('A new master user needs a password'),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects a short password before touching the database', async () => {
    await expect(
      setMasterUser(prisma, { email: 'ada@example.com', password: 'short' }),
    ).rejects.toThrow(MasterUserError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    await expect(
      setMasterUser(prisma, { email: 'not-an-email', password: PASSWORD }),
    ).rejects.toThrow(new MasterUserError('Invalid email'));
  });
});
