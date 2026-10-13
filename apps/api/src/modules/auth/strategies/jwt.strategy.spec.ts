import { UnauthorizedException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { UserRole, type User as UserRow } from '@finnit/database';
import { PrismaService } from '../../../services/prisma.service';
import { JwtStrategy } from './jwt.strategy';

const userRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: 'salt:hash',
  role: UserRole.user,
  isMaster: false,
  googleSubject: null,
  disabledAt: null,
  lastLoginAt: null,
  tokenVersion: 2,
  invitedById: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

describe('JwtStrategy', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    strategy = new JwtStrategy(prisma);
  });

  it('returns the user for a current session', async () => {
    const user = userRow();
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      strategy.validate({ sub: 'user-1', email: user.email, ver: 2 }),
    ).resolves.toBe(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('accepts tokens without `ver` while the user is on version 0', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow({ tokenVersion: 0 }));

    await expect(
      strategy.validate({ sub: 'user-1', email: 'test@example.com' }),
    ).resolves.toMatchObject({ id: 'user-1' });
  });

  it('rejects a disabled user', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userRow({ disabledAt: new Date() }),
    );

    await expect(
      strategy.validate({ sub: 'user-1', email: 'test@example.com', ver: 2 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token with a stale version', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow({ tokenVersion: 3 }));

    await expect(
      strategy.validate({ sub: 'user-1', email: 'test@example.com', ver: 2 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'gone', email: 'x@example.com', ver: 0 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it.each(['refresh', 'reset'])(
    'rejects a %s token without querying',
    async (typ) => {
      await expect(
        strategy.validate({
          sub: 'user-1',
          email: 'test@example.com',
          ver: 2,
          typ,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it('accepts an access token', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'test@example.com',
        ver: 2,
        typ: 'access',
      }),
    ).resolves.toMatchObject({ id: 'user-1' });
  });

  it('rejects a token without subject without querying', async () => {
    await expect(
      strategy.validate({ email: 'x@example.com' } as never),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
