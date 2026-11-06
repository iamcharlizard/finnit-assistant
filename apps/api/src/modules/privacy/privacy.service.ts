import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../services/prisma.service';
import {
  ForbiddenError,
  NotFoundError,
  PrivacyLockedError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import { MailService } from '../mail/mail.service';
import {
  PRIVACY_PIN_MAX,
  PRIVACY_PIN_MIN,
  PRIVACY_UNLOCK_HEADER,
  RESET_LINK_MINUTES,
  UNLOCK_MINUTES,
  afterWrongPin,
  isValidPin,
  resetEmail,
} from './privacy-pin';

interface UnlockPayload {
  sub: string;
  typ: 'privacy';
  ver: number;
}

type RequestLike = { headers?: Record<string, string | string[] | undefined> };

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

/** Per request: whether the user unlocked their protected automatic names. */
const unlockedByRequest = new WeakMap<object, Promise<boolean>>();

/**
 * The privacy PIN: protected automatic names (alias rules) need it to show
 * what they look for, to be changed and to show their movements' bank
 * text. Entering it gives a short-lived unlock token; a forgotten PIN is
 * reset with an emailed single-use link.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async status(
    userId: string,
    req?: RequestLike,
  ): Promise<{ hasPin: boolean; unlocked: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { privacyPinHash: true },
    });
    return {
      hasPin: Boolean(user?.privacyPinHash),
      unlocked: req ? await this.isUnlocked(req, userId) : false,
    };
  }

  /** Sets the PIN (the current one is needed to change it). Ends every unlock. */
  async setPin(
    userId: string,
    pin: string,
    currentPin?: string | null,
  ): Promise<boolean> {
    this.assertPin(pin);
    const user = await this.user(userId);
    if (user.privacyPinHash) {
      if (!currentPin) throw new ValidationError('Enter your current PIN');
      await this.checkPin(user, currentPin);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        privacyPinHash: hashPassword(pin),
        privacyPinVersion: { increment: 1 },
        privacyPinFailedAttempts: 0,
        privacyPinLockedUntil: null,
      },
    });
    return true;
  }

  /** Checks the PIN and returns an unlock token for UNLOCK_MINUTES. */
  async unlock(
    userId: string,
    pin: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.user(userId);
    if (!user.privacyPinHash) {
      throw new ValidationError('You have no privacy PIN yet');
    }
    await this.checkPin(user, pin);
    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { privacyPinVersion: true },
    });
    const payload: UnlockPayload = {
      sub: userId,
      typ: 'privacy',
      ver: fresh.privacyPinVersion,
    };
    return {
      token: this.jwt.sign(payload, { expiresIn: `${UNLOCK_MINUTES}m` }),
      expiresAt: new Date(Date.now() + UNLOCK_MINUTES * 60_000),
    };
  }

  /** Whether the request carries a valid unlock token for this user (once per request). */
  isUnlocked(req: object, userId: string): Promise<boolean> {
    let result = unlockedByRequest.get(req);
    if (!result) {
      result = this.checkUnlock(req as RequestLike, userId);
      unlockedByRequest.set(req, result);
    }
    return result;
  }

  /** Throws PrivacyLockedError unless the request is unlocked. */
  async assertUnlocked(req: object, userId: string): Promise<void> {
    if (!(await this.isUnlocked(req, userId))) throw new PrivacyLockedError();
  }

  /** Emails a reset link (always answers true, so it says nothing about the account). */
  async requestReset(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, locale: true, privacyPinHash: true },
    });
    if (!user?.privacyPinHash) return true;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.privacyPinReset.create({
      data: {
        userId,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60_000),
      },
    });
    const base = (process.env.WEB_APP_URL ?? 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
    const link = `${base}/settings/privacy/reset?token=${token}`;
    const { subject, text } = resetEmail(user.locale, user.name, link);
    await this.mail.send({ to: user.email, subject, text });
    return true;
  }

  /** Sets a new PIN with an emailed link (single use, the signed-in user's own). */
  async resetPin(userId: string, token: string, pin: string): Promise<boolean> {
    this.assertPin(pin);
    const reset = await this.prisma.privacyPinReset.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (
      !reset ||
      reset.userId !== userId ||
      reset.usedAt ||
      reset.expiresAt < new Date()
    ) {
      throw new ForbiddenError(
        'This link is no longer valid; ask for a new one',
      );
    }
    await this.prisma.$transaction([
      this.prisma.privacyPinReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          privacyPinHash: hashPassword(pin),
          privacyPinVersion: { increment: 1 },
          privacyPinFailedAttempts: 0,
          privacyPinLockedUntil: null,
        },
      }),
    ]);
    return true;
  }

  private async checkUnlock(
    req: RequestLike,
    userId: string,
  ): Promise<boolean> {
    const header = req.headers?.[PRIVACY_UNLOCK_HEADER];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token) return false;
    let payload: UnlockPayload;
    try {
      payload = this.jwt.verify<UnlockPayload>(token);
    } catch {
      return false;
    }
    if (payload.typ !== 'privacy' || payload.sub !== userId) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { privacyPinVersion: true, privacyPinHash: true },
    });
    return Boolean(
      user?.privacyPinHash && user.privacyPinVersion === payload.ver,
    );
  }

  private assertPin(pin: string): void {
    if (!isValidPin(pin)) {
      throw new ValidationError(
        `The PIN must have ${PRIVACY_PIN_MIN} to ${PRIVACY_PIN_MAX} digits`,
      );
    }
  }

  private async user(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        privacyPinHash: true,
        privacyPinFailedAttempts: true,
        privacyPinLockedUntil: true,
      },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  /** Wrong PINs count; MAX_PIN_ATTEMPTS in a row pause attempts. */
  private async checkPin(
    user: {
      id: string;
      privacyPinHash: string | null;
      privacyPinFailedAttempts: number;
      privacyPinLockedUntil: Date | null;
    },
    pin: string,
  ): Promise<void> {
    const now = new Date();
    if (user.privacyPinLockedUntil && user.privacyPinLockedUntil > now) {
      throw new ForbiddenError(
        'Too many wrong PINs; try again in a few minutes',
      );
    }
    if (await verifyPassword(pin, user.privacyPinHash)) {
      if (user.privacyPinFailedAttempts > 0) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { privacyPinFailedAttempts: 0, privacyPinLockedUntil: null },
        });
      }
      return;
    }
    const next = afterWrongPin(user.privacyPinFailedAttempts, now);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        privacyPinFailedAttempts: next.failedAttempts,
        privacyPinLockedUntil: next.lockedUntil,
      },
    });
    throw new ValidationError('Wrong PIN');
  }
}
