import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import type { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../services/prisma.service';
import { hashPassword } from '../../common/utils/password.util';
import { ConsoleMailService } from '../mail/mail.service';
import {
  MAX_PIN_ATTEMPTS,
  PRIVACY_UNLOCK_HEADER,
  afterWrongPin,
  isValidPin,
} from './privacy-pin';
import { PrivacyService } from './privacy.service';

describe('privacy PIN rules', () => {
  it('takes 4 to 8 digits', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('12345678')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('123456789')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });

  it('pauses attempts after too many wrong PINs', () => {
    const now = new Date('2026-11-05T10:00:00Z');
    expect(afterWrongPin(0, now)).toEqual({
      failedAttempts: 1,
      lockedUntil: null,
    });
    const paused = afterWrongPin(MAX_PIN_ATTEMPTS - 1, now);
    expect(paused.failedAttempts).toBe(0);
    expect(paused.lockedUntil?.toISOString()).toBe('2026-11-05T10:15:00.000Z');
  });
});

describe('PrivacyService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let mail: ConsoleMailService;
  let service: PrivacyService;
  // test/setup.ts mocks @nestjs/jwt: a tiny signer that keeps the payload.
  const jwt = {
    sign: (payload: object) =>
      `signed.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`,
    verify: (token: string) => {
      if (!token.startsWith('signed.')) throw new Error('invalid signature');
      return JSON.parse(
        Buffer.from(token.slice('signed.'.length), 'base64url').toString(),
      ) as object;
    },
  } as unknown as JwtService;
  const user = {
    id: 'u1',
    privacyPinHash: hashPassword('2468'),
    privacyPinFailedAttempts: 0,
    privacyPinLockedUntil: null,
    privacyPinVersion: 3,
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    mail = new ConsoleMailService();
    jest.spyOn(mail['logger'], 'log').mockImplementation(() => undefined);
    prisma.user.findUnique.mockResolvedValue(user as never);
    prisma.user.findUniqueOrThrow.mockResolvedValue(user as never);
    service = new PrivacyService(prisma, jwt, mail);
  });

  it('unlocks with the right PIN, for that user and PIN version only', async () => {
    const { token } = await service.unlock('u1', '2468');
    const req = { headers: { [PRIVACY_UNLOCK_HEADER]: token } };
    await expect(service.isUnlocked(req, 'u1')).resolves.toBe(true);
    await expect(
      service.isUnlocked({ headers: { [PRIVACY_UNLOCK_HEADER]: token } }, 'u2'),
    ).resolves.toBe(false);

    // A changed PIN (new version) ends the unlock.
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      privacyPinVersion: 4,
    } as never);
    await expect(
      service.isUnlocked({ headers: { [PRIVACY_UNLOCK_HEADER]: token } }, 'u1'),
    ).resolves.toBe(false);
  });

  it('counts a wrong PIN', async () => {
    await expect(service.unlock('u1', '0000')).rejects.toThrow('Wrong PIN');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { privacyPinFailedAttempts: 1, privacyPinLockedUntil: null },
    });
  });

  it('refuses attempts while paused', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      privacyPinLockedUntil: new Date(Date.now() + 60_000),
    } as never);
    await expect(service.unlock('u1', '2468')).rejects.toThrow(
      /Too many wrong PINs/,
    );
  });

  it('needs the current PIN to change it', async () => {
    await expect(service.setPin('u1', '1357')).rejects.toThrow(
      'Enter your current PIN',
    );
    await service.setPin('u1', '1357', '2468');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          privacyPinVersion: { increment: 1 },
        }),
      }),
    );
  });

  it('emails a single-use reset link (stored hashed)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      email: 'ada@example.com',
      name: 'Ada',
      locale: 'es',
    } as never);

    await service.requestReset('u1');

    const stored = prisma.privacyPinReset.create.mock.calls[0][0].data;
    const [message] = mail.sent;
    expect(message.to).toBe('ada@example.com');
    const token = /token=([\w-]+)/.exec(message.text)?.[1];
    expect(token).toBeTruthy();
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toHaveLength(64);
  });

  it('resets the PIN with a valid link and refuses a used one', async () => {
    prisma.privacyPinReset.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      tokenHash: 'h',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    });
    await expect(service.resetPin('u1', 'tok', '9876')).resolves.toBe(true);

    prisma.privacyPinReset.findUnique.mockResolvedValue({
      id: 'r1',
      userId: 'u1',
      tokenHash: 'h',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
      createdAt: new Date(),
    });
    await expect(service.resetPin('u1', 'tok', '9876')).rejects.toThrow(
      /no longer valid/,
    );
  });
});
