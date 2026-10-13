import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { UserRole, type User as UserRow } from '@finnit/database';
import { AuthService, NO_ACCESS_MESSAGE, isSessionValid } from './auth.service';
import {
  GoogleIdentity,
  GoogleIdTokenVerifier,
  InvalidGoogleTokenError,
} from './google-id-token.verifier';
import { PrismaService } from '../../services/prisma.service';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '../../common/exceptions/graphql-error.exception';
import { hashPassword } from '../../common/utils/password.util';
import * as bcrypt from 'bcrypt';

// Legacy (pre-PBKDF2) hashes are still checked with bcrypt.
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const PASSWORD = 'password123';
const PASSWORD_HASH = hashPassword(PASSWORD);

function userRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: PASSWORD_HASH,
    role: UserRole.user,
    isMaster: false,
    googleSubject: null,
    disabledAt: null,
    lastLoginAt: null,
    tokenVersion: 3,
    locale: 'es',
    invitedById: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

const expectedUserModel = (user: UserRow) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isMaster: user.isMaster,
  hasPassword: Boolean(user.passwordHash),
  hasGoogle: Boolean(user.googleSubject),
  locale: user.locale,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: DeepMockProxy<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let google: { isConfigured: boolean; verify: jest.Mock };

  beforeEach(async () => {
    prismaService = mockDeep<PrismaService>();
    google = { isConfigured: true, verify: jest.fn() };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: GoogleIdTokenVerifier, useValue: google },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
    jwtService.sign
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token');
    prismaService.user.update.mockImplementation(
      (args) =>
        Promise.resolve(userRow(args.data as Partial<UserRow>)) as never,
    );
  });

  describe('isSessionValid', () => {
    it('accepts an enabled user whose tokenVersion matches', () => {
      expect(isSessionValid(userRow({ tokenVersion: 2 }), 2)).toBe(true);
    });

    it('treats a token without `ver` as version 0', () => {
      expect(isSessionValid(userRow({ tokenVersion: 0 }), undefined)).toBe(
        true,
      );
      expect(isSessionValid(userRow({ tokenVersion: 1 }), undefined)).toBe(
        false,
      );
    });

    it('rejects a stale version, a disabled user and a missing user', () => {
      expect(isSessionValid(userRow({ tokenVersion: 2 }), 1)).toBe(false);
      expect(
        isSessionValid(userRow({ tokenVersion: 2, disabledAt: new Date() }), 2),
      ).toBe(false);
      expect(isSessionValid(null, 0)).toBe(false);
    });
  });

  describe('signIn', () => {
    const signInInput = { email: 'test@example.com', password: PASSWORD };

    it('signs in with valid credentials and returns the user model', async () => {
      const user = userRow();
      prismaService.user.findFirst.mockResolvedValue(user);

      const result = await service.signIn(signInInput);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: expectedUserModel(user),
      });
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('looks the email up case-insensitively (and trimmed)', async () => {
      prismaService.user.findFirst.mockResolvedValue(userRow());

      await service.signIn({
        email: '  Test@Example.COM ',
        password: PASSWORD,
      });

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: 'Test@Example.COM', mode: 'insensitive' },
        },
      });
    });

    it('records lastLoginAt', async () => {
      prismaService.user.findFirst.mockResolvedValue(userRow());

      await service.signIn(signInInput);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('signs typed tokens carrying the user tokenVersion as `ver`', async () => {
      prismaService.user.findFirst.mockResolvedValue(
        userRow({ tokenVersion: 7 }),
      );

      await service.signIn(signInInput);

      const payload = { sub: 'user-1', email: 'test@example.com', ver: 7 };
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        { ...payload, typ: 'access' },
        { expiresIn: '15m' },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { ...payload, typ: 'refresh' },
        { expiresIn: '7d' },
      );
    });

    it('rejects an unknown email', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.signIn(signInInput)).rejects.toThrow(
        new UnauthorizedError('Invalid credentials'),
      );
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('rejects a wrong password', async () => {
      prismaService.user.findFirst.mockResolvedValue(userRow());

      await expect(
        service.signIn({ ...signInInput, password: 'wrong-password' }),
      ).rejects.toThrow(new UnauthorizedError('Invalid credentials'));
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('rejects users without a password (Google only)', async () => {
      prismaService.user.findFirst.mockResolvedValue(
        userRow({ passwordHash: null, googleSubject: 'google-sub' }),
      );

      await expect(service.signIn(signInInput)).rejects.toThrow(
        new UnauthorizedError('Invalid credentials'),
      );
    });

    it('rejects disabled users with the same error', async () => {
      prismaService.user.findFirst.mockResolvedValue(
        userRow({ disabledAt: new Date() }),
      );

      await expect(service.signIn(signInInput)).rejects.toThrow(
        new UnauthorizedError('Invalid credentials'),
      );
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('accepts legacy bcrypt hashes', async () => {
      prismaService.user.findFirst.mockResolvedValue(
        userRow({ passwordHash: '$2b$10$legacyhash' }),
      );
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.signIn(signInInput)).resolves.toMatchObject({
        accessToken: 'access-token',
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        PASSWORD,
        '$2b$10$legacyhash',
      );
    });

    it('treats a bcrypt failure as invalid credentials', async () => {
      prismaService.user.findFirst.mockResolvedValue(
        userRow({ passwordHash: '$2b$10$legacyhash' }),
      );
      (mockedBcrypt.compare as jest.Mock).mockRejectedValue(
        new Error('Compare failed'),
      );

      await expect(service.signIn(signInInput)).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });

  describe('signInWithGoogle', () => {
    const input = { idToken: 'google-id-token', nonce: 'nonce-1' };
    const identity: GoogleIdentity = {
      subject: 'google-sub',
      email: 'test@example.com',
      emailVerified: true,
      nonce: 'nonce-1',
    };

    beforeEach(() => {
      google.verify.mockResolvedValue(identity);
    });

    it('signs in a user already linked by Google subject', async () => {
      const user = userRow({ googleSubject: 'google-sub' });
      prismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.signInWithGoogle(input);

      expect(google.verify).toHaveBeenCalledWith('google-id-token');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { googleSubject: 'google-sub' },
      });
      expect(prismaService.user.findFirst).not.toHaveBeenCalled();
      // Only lastLoginAt is written: the account is already linked.
      expect(prismaService.user.update).toHaveBeenCalledTimes(1);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(result.user).toEqual(expectedUserModel(user));
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: user.id,
          email: user.email,
          ver: user.tokenVersion,
          typ: 'access',
        },
        { expiresIn: '15m' },
      );
    });

    it('links the Google account by email on the first sign-in', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.findFirst.mockResolvedValue(userRow());

      const result = await service.signInWithGoogle(input);

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: 'test@example.com', mode: 'insensitive' },
          googleSubject: null,
        },
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { googleSubject: 'google-sub' },
      });
      expect(result.user.hasGoogle).toBe(true);
    });

    it('never creates users: unknown people get ForbiddenError', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.signInWithGoogle(input)).rejects.toThrow(
        new ForbiddenError(NO_ACCESS_MESSAGE),
      );
      expect(prismaService.user.create).not.toHaveBeenCalled();
      expect(prismaService.user.update).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('rejects disabled users with ForbiddenError', async () => {
      prismaService.user.findUnique.mockResolvedValue(
        userRow({ googleSubject: 'google-sub', disabledAt: new Date() }),
      );

      await expect(service.signInWithGoogle(input)).rejects.toThrow(
        new ForbiddenError(NO_ACCESS_MESSAGE),
      );
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('rejects a Google email that is not verified', async () => {
      google.verify.mockResolvedValue({ ...identity, emailVerified: false });

      await expect(service.signInWithGoogle(input)).rejects.toThrow(
        UnauthorizedError,
      );
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a nonce mismatch', async () => {
      google.verify.mockResolvedValue({ ...identity, nonce: 'other' });

      await expect(service.signInWithGoogle(input)).rejects.toThrow(
        new UnauthorizedError('Invalid Google sign-in'),
      );
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a token without nonce when one was expected', async () => {
      google.verify.mockResolvedValue({ ...identity, nonce: undefined });

      await expect(service.signInWithGoogle(input)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('does not check the nonce when the client sent none', async () => {
      google.verify.mockResolvedValue({ ...identity, nonce: undefined });
      prismaService.user.findUnique.mockResolvedValue(
        userRow({ googleSubject: 'google-sub' }),
      );

      await expect(
        service.signInWithGoogle({ idToken: 'google-id-token' }),
      ).resolves.toMatchObject({ accessToken: 'access-token' });
    });

    it('maps an invalid Google token to UnauthorizedError', async () => {
      google.verify.mockRejectedValue(new InvalidGoogleTokenError('expired'));

      await expect(service.signInWithGoogle(input)).rejects.toThrow(
        new UnauthorizedError('Invalid Google sign-in'),
      );
    });

    it('lets unexpected verifier errors through', async () => {
      google.verify.mockRejectedValue(new Error('network down'));

      await expect(service.signInWithGoogle(input)).rejects.toThrow(
        'network down',
      );
    });

    it('is unavailable when Google is not configured', async () => {
      google.isConfigured = false;

      await expect(service.signInWithGoogle(input)).rejects.toThrow(
        ForbiddenError,
      );
      expect(google.verify).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const refreshTokenInput = { refreshToken: 'valid-refresh-token' };

    it('issues new tokens for a current session', async () => {
      const user = userRow({ tokenVersion: 3 });
      jwtService.verify.mockReturnValue({
        sub: user.id,
        email: user.email,
        ver: 3,
        typ: 'refresh',
      });
      prismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.refreshToken(refreshTokenInput);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
      });
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: expectedUserModel(user),
      });
    });

    it('still accepts legacy refresh tokens without `typ`', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        email: 'test@example.com',
        ver: 3,
      });
      prismaService.user.findUnique.mockResolvedValue(
        userRow({ tokenVersion: 3 }),
      );

      await expect(
        service.refreshToken(refreshTokenInput),
      ).resolves.toMatchObject({ accessToken: 'access-token' });
    });

    it.each([
      ['an access token', { sub: 'user-1', ver: 3, typ: 'access' }],
      ['a reset token', { userId: 'user-1', ver: 3, typ: 'reset' }],
      ['a token without sub', { email: 'test@example.com', ver: 3 }],
    ])('rejects %s without querying the database', async (_case, payload) => {
      jwtService.verify.mockReturnValue(payload);

      await expect(service.refreshToken(refreshTokenInput)).rejects.toThrow(
        new UnauthorizedError('Invalid refresh token'),
      );
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('rejects an invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshTokenInput)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('rejects a missing user', async () => {
      jwtService.verify.mockReturnValue({ sub: 'gone', email: 'x', ver: 0 });
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(refreshTokenInput)).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('rejects a token with a stale version (sessions revoked)', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        email: 'test@example.com',
        ver: 2,
      });
      prismaService.user.findUnique.mockResolvedValue(
        userRow({ tokenVersion: 3 }),
      );

      await expect(service.refreshToken(refreshTokenInput)).rejects.toThrow(
        UnauthorizedError,
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('rejects a disabled user', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-1',
        email: 'test@example.com',
        ver: 3,
      });
      prismaService.user.findUnique.mockResolvedValue(
        userRow({ tokenVersion: 3, disabledAt: new Date() }),
      );

      await expect(service.refreshToken(refreshTokenInput)).rejects.toThrow(
        UnauthorizedError,
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    const requestPasswordResetInput = { email: 'test@example.com' };

    it('returns true and signs a reset token when the user exists', async () => {
      jwtService.sign.mockReset().mockReturnValue('reset-token-jwt');
      prismaService.user.findFirst.mockResolvedValue(
        userRow({ tokenVersion: 4 }),
      );

      const result = await service.requestPasswordReset({
        email: ' Test@Example.com ',
      });

      expect(result).toBe(true);
      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: 'Test@Example.com', mode: 'insensitive' },
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        { userId: 'user-1', ver: 4, typ: 'reset' },
        { expiresIn: '15m' },
      );
    });

    it('returns true without a token for a disabled user', async () => {
      prismaService.user.findFirst.mockResolvedValue(
        userRow({ disabledAt: new Date() }),
      );

      await expect(
        service.requestPasswordReset(requestPasswordResetInput),
      ).resolves.toBe(true);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('returns true even if the user does not exist', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.requestPasswordReset(
        requestPasswordResetInput,
      );

      expect(result).toBe(true);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const resetPasswordInput = {
      token: 'valid-reset-token',
      newPassword: 'newpassword123',
    };
    // userRow() is on tokenVersion 3.
    const resetPayload = { userId: 'user-1', ver: 3, typ: 'reset' };

    it('stores a PBKDF2 hash and ends every open session', async () => {
      jwtService.verify.mockReturnValue(resetPayload);
      prismaService.user.findUnique.mockResolvedValue(userRow());

      const result = await service.resetPassword(resetPasswordInput);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-reset-token');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordHash: expect.stringMatching(/^[0-9a-f]{32}:[0-9a-f]{128}$/),
          tokenVersion: { increment: 1 },
        },
      });
      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('throws ValidationError if the token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.resetPassword(resetPasswordInput)).rejects.toThrow(
        ValidationError,
      );
    });

    it('throws NotFoundError if the user does not exist', async () => {
      jwtService.verify.mockReturnValue({ ...resetPayload, userId: 'gone' });
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword(resetPasswordInput)).rejects.toThrow(
        NotFoundError,
      );
    });

    it.each([
      ['an access token', { sub: 'user-1', ver: 3, typ: 'access' }],
      ['a legacy reset token without typ', { userId: 'user-1' }],
      ['a reset token without userId', { ver: 3, typ: 'reset' }],
    ])('rejects %s', async (_case, payload) => {
      jwtService.verify.mockReturnValue(payload);

      await expect(service.resetPassword(resetPasswordInput)).rejects.toThrow(
        ValidationError,
      );
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it.each([
      [
        'the token version is stale (already used)',
        userRow({ tokenVersion: 4 }),
      ],
      ['the user is disabled', userRow({ disabledAt: new Date() })],
    ])('rejects the token when %s', async (_case, user) => {
      jwtService.verify.mockReturnValue(resetPayload);
      prismaService.user.findUnique.mockResolvedValue(user);

      await expect(service.resetPassword(resetPasswordInput)).rejects.toThrow(
        ValidationError,
      );
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('returns valid for a current session', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', ver: 3 });
      prismaService.user.findUnique.mockResolvedValue(
        userRow({ tokenVersion: 3 }),
      );

      await expect(service.validateToken('token')).resolves.toEqual({
        valid: true,
      });
    });

    it.each([
      ['a refresh token', { sub: 'user-1', ver: 3, typ: 'refresh' }],
      ['a reset token', { userId: 'user-1', ver: 3, typ: 'reset' }],
    ])('returns invalid for %s', async (_case, payload) => {
      jwtService.verify.mockReturnValue(payload);

      await expect(service.validateToken('token')).resolves.toEqual({
        valid: false,
        message: 'Invalid token',
      });
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('returns invalid for a token that does not verify', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.validateToken('token')).resolves.toEqual({
        valid: false,
        message: 'Invalid token',
      });
    });

    it.each([
      ['a missing user', null],
      ['a stale version', userRow({ tokenVersion: 4 })],
      ['a disabled user', userRow({ tokenVersion: 3, disabledAt: new Date() })],
    ])('returns "Session ended" for %s', async (_case, user) => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', ver: 3 });
      prismaService.user.findUnique.mockResolvedValue(user);

      await expect(service.validateToken('token')).resolves.toEqual({
        valid: false,
        message: 'Session ended',
      });
    });
  });

  describe('getCurrentUser', () => {
    it('returns the user model', async () => {
      const user = userRow();
      prismaService.user.findUnique.mockResolvedValue(user);

      await expect(service.getCurrentUser('user-1')).resolves.toEqual(
        expectedUserModel(user),
      );
    });

    it('throws NotFoundError if the user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser('gone')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
