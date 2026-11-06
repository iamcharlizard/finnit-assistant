import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../../services/prisma.service';
import { ValidationError } from '../../common/exceptions/graphql-error.exception';
import { S3StorageService } from '../storage/s3-storage.service';
import { AvatarService, MAX_AVATAR_BYTES } from './avatar.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const PDF = Buffer.from('%PDF-1.7 hello');

const userRow = (overrides: Record<string, unknown> = {}) =>
  ({
    id: USER_ID,
    name: 'Ada',
    email: 'ada@example.com',
    role: 'user',
    isMaster: false,
    passwordHash: null,
    googleSubject: null,
    googlePictureUrl: null,
    avatarKey: null,
    avatarUpdatedAt: null,
    locale: 'es',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }) as never;

describe('AvatarService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let storage: DeepMockProxy<S3StorageService>;
  let service: AvatarService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    storage = mockDeep<S3StorageService>();
    service = new AvatarService(prisma, storage);
  });

  it('stores the photo under the user, replaces the old one and shows it', async () => {
    const oldKey = `users/${USER_ID}/avatars/22222222-2222-4222-8222-222222222222.jpg`;
    prisma.user.findUnique.mockResolvedValue({ avatarKey: oldKey } as never);
    prisma.user.update.mockImplementation(
      (args) =>
        Promise.resolve(userRow(args.data as Record<string, unknown>)) as never,
    );

    const user = await service.upload(USER_ID, { buffer: PNG, size: 10 });

    const [key, , mime] = storage.put.mock.calls[0];
    expect(key).toMatch(
      new RegExp(`^users/${USER_ID}/avatars/[0-9a-f-]{36}\\.png$`),
    );
    expect(mime).toBe('image/png');
    expect(storage.delete).toHaveBeenCalledWith(oldKey);
    expect(user.avatar).toMatchObject({ source: 'uploaded', url: null });
  });

  it('accepts only JPEG, PNG or WEBP up to 2 MB', async () => {
    await expect(
      service.upload(USER_ID, { buffer: PDF, size: 20 }),
    ).rejects.toThrow(ValidationError);
    await expect(
      service.upload(USER_ID, { buffer: PNG, size: MAX_AVATAR_BYTES + 1 }),
    ).rejects.toThrow(ValidationError);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('falls back to the Google picture when the photo is removed', async () => {
    prisma.user.findUnique.mockResolvedValue({ avatarKey: null } as never);
    prisma.user.update.mockResolvedValue(
      userRow({
        googlePictureUrl: 'https://lh3.googleusercontent.com/a/x',
        avatarUpdatedAt: new Date('2026-11-05'),
      }),
    );

    const user = await service.remove(USER_ID);

    expect(user.avatar).toEqual({
      source: 'google',
      url: 'https://lh3.googleusercontent.com/a/x',
      version: String(new Date('2026-11-05').getTime()),
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
