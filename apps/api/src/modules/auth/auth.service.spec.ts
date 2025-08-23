import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '../../common/exceptions/graphql-error.exception';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      category: {
        create: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    const signUpInput = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    };

    it('should successfully create a new user and return auth payload', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      prismaService.user.create.mockResolvedValue(mockUser);
      prismaService.category.create.mockResolvedValue({ id: 'category-1' } as any);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act
      const result = await service.signUp(signUpInput);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: signUpInput.email },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(signUpInput.password, 12);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: signUpInput.name,
          email: signUpInput.email,
          passwordHash: 'hashed-password',
        },
      });
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      });
    });

    it('should throw ConflictError if user already exists', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.signUp(signUpInput)).rejects.toThrow(ConflictError);
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should create default categories for new user', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      prismaService.user.create.mockResolvedValue(mockUser);
      prismaService.category.create.mockResolvedValue({ id: 'category-1' } as any);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act
      await service.signUp(signUpInput);

      // Assert
      expect(prismaService.category.create).toHaveBeenCalled();
      const createCalls = prismaService.category.create.mock.calls;
      expect(createCalls.length).toBeGreaterThan(10); // Should create multiple categories
      
      // Check some specific categories were created
      const categoryNames = createCalls.map(call => call[0].data.name);
      expect(categoryNames).toContain('Food & Dining');
      expect(categoryNames).toContain('Transportation');
      expect(categoryNames).toContain('Income');
    });
  });

  describe('signIn', () => {
    const signInInput = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should successfully sign in user with valid credentials', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act
      const result = await service.signIn(signInInput);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: signInInput.email },
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        signInInput.password,
        mockUser.passwordHash
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      });
    });

    it('should throw UnauthorizedError if user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.signIn(signInInput)).rejects.toThrow(UnauthorizedError);
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedError if password is invalid', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(service.signIn(signInInput)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refreshToken', () => {
    const refreshTokenInput = {
      refreshToken: 'valid-refresh-token',
    };

    it('should successfully refresh token with valid refresh token', async () => {
      // Arrange
      const payload = { sub: mockUser.id, email: mockUser.email };
      jwtService.verify.mockReturnValue(payload);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      // Act
      const result = await service.refreshToken(refreshTokenInput);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith(refreshTokenInput.refreshToken);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: payload.sub },
      });
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      });
    });

    it('should throw UnauthorizedError if refresh token is invalid', async () => {
      // Arrange
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(service.refreshToken(refreshTokenInput)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if user not found', async () => {
      // Arrange
      const payload = { sub: 'non-existent-user', email: 'test@example.com' };
      jwtService.verify.mockReturnValue(payload);
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.refreshToken(refreshTokenInput)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('requestPasswordReset', () => {
    const requestPasswordResetInput = {
      email: 'test@example.com',
    };

    it('should return true regardless of whether user exists (security)', async () => {
      // Arrange - user exists
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('reset-token-jwt');

      // Act
      const result = await service.requestPasswordReset(requestPasswordResetInput);

      // Assert
      expect(result).toBe(true);
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should return true even if user does not exist', async () => {
      // Arrange - user doesn't exist
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.requestPasswordReset(requestPasswordResetInput);

      // Assert
      expect(result).toBe(true);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should generate JWT token with correct payload when user exists', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('reset-token-jwt');

      // Act
      await service.requestPasswordReset(requestPasswordResetInput);

      // Assert
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          exp: expect.any(Number),
        }),
        { expiresIn: '15m' }
      );
    });
  });

  describe('resetPassword', () => {
    const resetPasswordInput = {
      token: 'valid-reset-token',
      newPassword: 'newpassword123',
    };

    it('should successfully reset password with valid token', async () => {
      // Arrange
      const payload = { userId: mockUser.id };
      jwtService.verify.mockReturnValue(payload);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.hash.mockResolvedValue('new-hashed-password');
      prismaService.user.update.mockResolvedValue({ ...mockUser, passwordHash: 'new-hashed-password' });

      // Act
      const result = await service.resetPassword(resetPasswordInput);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith(resetPasswordInput.token);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: payload.userId },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(resetPasswordInput.newPassword, 12);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { passwordHash: 'new-hashed-password' },
      });
      expect(result).toBe(true);
    });

    it('should throw ValidationError if token is invalid', async () => {
      // Arrange
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(service.resetPassword(resetPasswordInput)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError if user not found', async () => {
      // Arrange
      const payload = { userId: 'non-existent-user' };
      jwtService.verify.mockReturnValue(payload);
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.resetPassword(resetPasswordInput)).rejects.toThrow(NotFoundError);
    });
  });

  describe('validateToken', () => {
    it('should return valid true for valid token', async () => {
      // Arrange
      const payload = { sub: mockUser.id, email: mockUser.email };
      jwtService.verify.mockReturnValue(payload);
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.validateToken('valid-token');

      // Assert
      expect(result).toEqual({ valid: true });
    });

    it('should return valid false for invalid token', async () => {
      // Arrange
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      const result = await service.validateToken('invalid-token');

      // Assert
      expect(result).toEqual({
        valid: false,
        message: 'Invalid token',
      });
    });

    it('should return valid false if user not found', async () => {
      // Arrange
      const payload = { sub: 'non-existent-user', email: 'test@example.com' };
      jwtService.verify.mockReturnValue(payload);
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.validateToken('valid-token');

      // Assert
      expect(result).toEqual({
        valid: false,
        message: 'User not found',
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return user data for valid user ID', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.getCurrentUser(mockUser.id);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw NotFoundError if user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getCurrentUser('non-existent-user')).rejects.toThrow(NotFoundError);
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens with correct payloads', () => {
      // Arrange
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act
      const result = (service as any).generateTokens(mockUser.id, mockUser.email);

      // Assert
      expect(jwtService.sign).toHaveBeenNthCalledWith(1, 
        { sub: mockUser.id, email: mockUser.email }, 
        { expiresIn: '15m' }
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(2, 
        { sub: mockUser.id, email: mockUser.email }, 
        { expiresIn: '7d' }
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle bcrypt hash failure during signup', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);
      mockedBcrypt.hash.mockRejectedValue(new Error('Hashing failed'));

      // Act & Assert
      await expect(service.signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      })).rejects.toThrow('Hashing failed');
    });

    it('should handle database error during user creation', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      prismaService.user.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.signUp({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      })).rejects.toThrow('Database error');
    });

    it('should handle bcrypt compare failure during signin', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockRejectedValue(new Error('Compare failed'));

      // Act & Assert
      await expect(service.signIn({
        email: 'test@example.com',
        password: 'password123',
      })).rejects.toThrow('Compare failed');
    });
  });
});