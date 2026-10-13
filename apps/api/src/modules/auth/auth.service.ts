import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User as UserRow } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  SignInInput,
  SignInWithGoogleInput,
  AuthPayload,
  RefreshTokenInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  TokenValidationResult,
} from './dto/auth.dto';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '../../common/exceptions/graphql-error.exception';
import { User, toUserModel } from '../../common/types/models/user.model';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import {
  GoogleIdTokenVerifier,
  InvalidGoogleTokenError,
  type GoogleIdentity,
} from './google-id-token.verifier';

/** Access and refresh token payload. `ver` must match User.tokenVersion. */
export interface JwtAuthPayload {
  sub: string;
  email: string;
  ver?: number;
  /** Token kind; tokens issued before it existed have none. */
  typ?: 'access' | 'refresh';
}

interface JwtResetPayload {
  userId: string;
  ver: number;
  typ: 'reset';
}

export const NO_ACCESS_MESSAGE =
  'Tu cuenta no tiene acceso a Finnit. Pide acceso al administrador.';

/** A user may hold a session: exists, is enabled, and the token is current. */
export function isSessionValid(
  user: Pick<UserRow, 'disabledAt' | 'tokenVersion'> | null,
  tokenVersion: number | undefined,
): boolean {
  // Tokens issued before tokenVersion existed carry no `ver`: version 0.
  return (
    !!user && !user.disabledAt && (tokenVersion ?? 0) === user.tokenVersion
  );
}

/**
 * Sign-in only: accounts are created by an admin (AdminUsersService).
 * Email/password works when the admin assigned a password; Google works
 * when the Google account's email matches an existing, enabled user.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly google: GoogleIdTokenVerifier,
  ) {}

  async signIn(input: SignInInput): Promise<AuthPayload> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: input.email.trim(), mode: 'insensitive' } },
    });
    // Same error whether the email exists, has no password or is disabled.
    if (
      !user ||
      user.disabledAt ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      throw new UnauthorizedError('Invalid credentials');
    }
    return this.startSession(user);
  }

  async signInWithGoogle(input: SignInWithGoogleInput): Promise<AuthPayload> {
    if (!this.google.isConfigured) {
      throw new ForbiddenError('Google sign-in is not available');
    }
    let identity: GoogleIdentity;
    try {
      identity = await this.google.verify(input.idToken);
    } catch (error) {
      if (error instanceof InvalidGoogleTokenError) {
        this.logger.warn(`Rejected Google token: ${error.message}`);
        throw new UnauthorizedError('Invalid Google sign-in');
      }
      throw error;
    }
    if (!identity.emailVerified) {
      throw new UnauthorizedError('Your Google email is not verified');
    }
    if (input.nonce !== undefined && identity.nonce !== input.nonce) {
      throw new UnauthorizedError('Invalid Google sign-in');
    }

    const bySubject = await this.prisma.user.findUnique({
      where: { googleSubject: identity.subject },
    });
    const user =
      bySubject ??
      (await this.prisma.user.findFirst({
        where: {
          email: { equals: identity.email, mode: 'insensitive' },
          googleSubject: null,
        },
      }));
    if (!user || user.disabledAt) throw new ForbiddenError(NO_ACCESS_MESSAGE);

    const linked = user.googleSubject
      ? user
      : await this.prisma.user.update({
          where: { id: user.id },
          data: { googleSubject: identity.subject },
        });
    return this.startSession(linked);
  }

  async refreshToken(input: RefreshTokenInput): Promise<AuthPayload> {
    let payload: JwtAuthPayload;
    try {
      payload = this.jwtService.verify<JwtAuthPayload>(input.refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
    // Only refresh tokens (or older tokens without a kind) can be refreshed.
    if (!payload.sub || (payload.typ && payload.typ !== 'refresh')) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !isSessionValid(user, payload.ver)) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    return {
      ...this.generateTokens(user),
      user: toUserModel(user),
    };
  }

  async requestPasswordReset(
    input: RequestPasswordResetInput,
  ): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: input.email.trim(), mode: 'insensitive' } },
    });

    if (!user || user.disabledAt) {
      // Don't reveal if user exists or not
      return true;
    }

    // Bound to the current tokenVersion: it stops working once used.
    const payload: JwtResetPayload = {
      userId: user.id,
      ver: user.tokenVersion,
      typ: 'reset',
    };
    const resetTokenJWT = this.jwtService.sign(payload, { expiresIn: '15m' });

    // TODO: Send email with reset link containing the resetTokenJWT
    // await this.emailService.sendPasswordResetEmail(user.email, resetTokenJWT);
    // Never log the token: anyone with log access could take over the account.
    void resetTokenJWT;

    return true;
  }

  async resetPassword(input: ResetPasswordInput): Promise<boolean> {
    try {
      const payload = this.jwtService.verify<JwtResetPayload>(input.token);
      if (payload.typ !== 'reset' || !payload.userId) {
        throw new ValidationError('Invalid or expired reset token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }
      if (user.disabledAt || user.tokenVersion !== payload.ver) {
        throw new ValidationError('Invalid or expired reset token');
      }

      // A new password closes every open session.
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashPassword(input.newPassword),
          tokenVersion: { increment: 1 },
        },
      });

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ValidationError('Invalid or expired reset token');
    }
  }

  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      const payload = this.jwtService.verify<JwtAuthPayload>(token);
      if (!payload.sub || (payload.typ && payload.typ !== 'access')) {
        return { valid: false, message: 'Invalid token' };
      }
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!isSessionValid(user, payload.ver)) {
        return { valid: false, message: 'Session ended' };
      }
      return { valid: true };
    } catch {
      return { valid: false, message: 'Invalid token' };
    }
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return toUserModel(user);
  }

  private async startSession(user: UserRow): Promise<AuthPayload> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return { ...this.generateTokens(user), user: toUserModel(user) };
  }

  private generateTokens(user: Pick<UserRow, 'id' | 'email' | 'tokenVersion'>) {
    const payload: JwtAuthPayload = {
      sub: user.id,
      email: user.email,
      ver: user.tokenVersion,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, typ: 'access' },
      { expiresIn: '15m' },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, typ: 'refresh' },
      { expiresIn: '7d' },
    );

    return { accessToken, refreshToken };
  }
}
