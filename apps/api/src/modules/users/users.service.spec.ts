import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { UserRole } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { ValidationError } from '../../common/exceptions/graphql-error.exception';
import { UsersService } from './users.service';
import type { AppLocale } from '../translation/locale';

const userRow = {
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  passwordHash: 'salt:hash',
  role: UserRole.user,
  isMaster: false,
  googleSubject: null,
  disabledAt: null,
  lastLoginAt: null,
  tokenVersion: 0,
  googlePictureUrl: null,
  avatarKey: null,
  avatarUpdatedAt: null,
  privacyPinHash: null,
  privacyPinVersion: 0,
  privacyPinFailedAttempts: 0,
  privacyPinLockedUntil: null,
  locale: 'en',
  invitedById: null,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
};

describe('UsersService.updatePreferences', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: UsersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new UsersService(prisma);
  });

  it('saves the locale and returns the user with it', async () => {
    prisma.user.update.mockResolvedValue(userRow);

    const user = await service.updatePreferences('user-1', { locale: 'en' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { locale: 'en' },
    });
    expect(user.locale).toBe('en');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects unsupported locales', async () => {
    await expect(
      service.updatePreferences('user-1', { locale: 'fr' as AppLocale }),
    ).rejects.toThrow(ValidationError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('UsersService.updateProfile', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: UsersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new UsersService(prisma);
  });

  it('writes only the trimmed name', async () => {
    prisma.user.update.mockResolvedValue({ ...userRow, name: 'Ada L' });

    await service.updateProfile('user-1', {
      name: '  Ada L ',
      // Extra fields a client might send must never reach the database.
      ...({ role: 'admin', email: 'x@y.z' } as object),
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Ada L' },
    });
  });

  it('rejects names that are too short', async () => {
    await expect(
      service.updateProfile('user-1', { name: ' a ' }),
    ).rejects.toThrow(ValidationError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
