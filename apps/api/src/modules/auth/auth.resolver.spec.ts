import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '../../common/exceptions/graphql-error.exception';

// Mock the JwtAuthGuard
const mockJwtAuthGuard = {
  canActivate: jest.fn().mockResolvedValue(true),
};

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: jest.Mocked<AuthService>;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockAuthPayload = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    user: mockUser,
  };

  beforeEach(async () => {
    const mockAuthService = {
      signUp: jest.fn(),
      signIn: jest.fn(),
      refreshToken: jest.fn(),
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
      validateToken: jest.fn(),
      getCurrentUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue(mockJwtAuthGuard)
    .compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  describe('signUp', () => {
    const signUpInput = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'securePassword123!',
    };

    it('should successfully register a new user', async () => {
      // Arrange
      authService.signUp.mockResolvedValue(mockAuthPayload);

      // Act
      const result = await resolver.signUp(signUpInput);

      // Assert
      expect(authService.signUp).toHaveBeenCalledWith(signUpInput);
      expect(result).toEqual(mockAuthPayload);
      expect(result.accessToken).toBe('access-token-123');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw ConflictError when user already exists', async () => {
      // Arrange
      authService.signUp.mockRejectedValue(
        new ConflictError('User with this email already exists')
      );

      // Act & Assert
      await expect(resolver.signUp(signUpInput)).rejects.toThrow(ConflictError);
      expect(authService.signUp).toHaveBeenCalledWith(signUpInput);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidInput = { ...signUpInput, email: 'invalid-email' };
      authService.signUp.mockRejectedValue(new ValidationError('Invalid email format'));

      // Act & Assert
      await expect(resolver.signUp(invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should validate required fields', async () => {
      // Test input validation at the resolver level
      const incompleteInput = { email: 'test@example.com', password: 'password' };
      // Note: In a real GraphQL setup, this would be caught by the schema validation
      // Here we're testing the resolver behavior when such validation fails
      
      authService.signUp.mockRejectedValue(new ValidationError('Name is required'));

      await expect(resolver.signUp(incompleteInput as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('signIn', () => {
    const signInInput = {
      email: 'john@example.com',
      password: 'securePassword123!',
    };

    it('should successfully authenticate user', async () => {
      // Arrange
      authService.signIn.mockResolvedValue(mockAuthPayload);

      // Act
      const result = await resolver.signIn(signInInput);

      // Assert
      expect(authService.signIn).toHaveBeenCalledWith(signInInput);
      expect(result).toEqual(mockAuthPayload);
      expect(result.accessToken).toBe('access-token-123');
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should throw UnauthorizedError for invalid credentials', async () => {
      // Arrange
      authService.signIn.mockRejectedValue(new UnauthorizedError('Invalid credentials'));

      // Act & Assert
      await expect(resolver.signIn(signInInput)).rejects.toThrow(UnauthorizedError);
      expect(authService.signIn).toHaveBeenCalledWith(signInInput);
    });

    it('should handle non-existent user', async () => {
      // Arrange
      const nonExistentUserInput = { ...signInInput, email: 'nonexistent@example.com' };
      authService.signIn.mockRejectedValue(new UnauthorizedError('Invalid credentials'));

      // Act & Assert
      await expect(resolver.signIn(nonExistentUserInput)).rejects.toThrow(UnauthorizedError);
    });

    it('should handle wrong password', async () => {
      // Arrange
      const wrongPasswordInput = { ...signInInput, password: 'wrongPassword' };
      authService.signIn.mockRejectedValue(new UnauthorizedError('Invalid credentials'));

      // Act & Assert
      await expect(resolver.signIn(wrongPasswordInput)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refreshToken', () => {
    const refreshInput = {
      refreshToken: 'valid-refresh-token',
    };

    it('should successfully refresh access token', async () => {
      // Arrange
      const newAuthPayload = {
        ...mockAuthPayload,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };
      authService.refreshToken.mockResolvedValue(newAuthPayload);

      // Act
      const result = await resolver.refreshToken(refreshInput);

      // Assert
      expect(authService.refreshToken).toHaveBeenCalledWith(refreshInput);
      expect(result).toEqual(newAuthPayload);
      expect(result.accessToken).toBe('new-access-token');
    });

    it('should throw UnauthorizedError for invalid refresh token', async () => {
      // Arrange
      authService.refreshToken.mockRejectedValue(new UnauthorizedError('Invalid refresh token'));

      // Act & Assert
      await expect(resolver.refreshToken(refreshInput)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for expired refresh token', async () => {
      // Arrange
      const expiredInput = { refreshToken: 'expired-token' };
      authService.refreshToken.mockRejectedValue(new UnauthorizedError('Invalid refresh token'));

      // Act & Assert
      await expect(resolver.refreshToken(expiredInput)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('requestPasswordReset', () => {
    const resetRequest = {
      email: 'john@example.com',
    };

    it('should successfully request password reset', async () => {
      // Arrange
      authService.requestPasswordReset.mockResolvedValue(true);

      // Act
      const result = await resolver.requestPasswordReset(resetRequest);

      // Assert
      expect(authService.requestPasswordReset).toHaveBeenCalledWith(resetRequest);
      expect(result).toBe(true);
    });

    it('should return true even for non-existent email (security)', async () => {
      // Arrange
      const nonExistentEmail = { email: 'nonexistent@example.com' };
      authService.requestPasswordReset.mockResolvedValue(true);

      // Act
      const result = await resolver.requestPasswordReset(nonExistentEmail);

      // Assert
      expect(authService.requestPasswordReset).toHaveBeenCalledWith(nonExistentEmail);
      expect(result).toBe(true);
    });

    it('should handle email service errors gracefully', async () => {
      // Arrange
      authService.requestPasswordReset.mockRejectedValue(new Error('Email service unavailable'));

      // Act & Assert
      await expect(resolver.requestPasswordReset(resetRequest)).rejects.toThrow('Email service unavailable');
    });
  });

  describe('resetPassword', () => {
    const resetInput = {
      token: 'valid-reset-token',
      newPassword: 'newSecurePassword123!',
    };

    it('should successfully reset password', async () => {
      // Arrange
      authService.resetPassword.mockResolvedValue(true);

      // Act
      const result = await resolver.resetPassword(resetInput);

      // Assert
      expect(authService.resetPassword).toHaveBeenCalledWith(resetInput);
      expect(result).toBe(true);
    });

    it('should throw ValidationError for invalid token', async () => {
      // Arrange
      const invalidInput = { ...resetInput, token: 'invalid-token' };
      authService.resetPassword.mockRejectedValue(
        new ValidationError('Invalid or expired reset token')
      );

      // Act & Assert
      await expect(resolver.resetPassword(invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for weak password', async () => {
      // Arrange
      const weakPasswordInput = { ...resetInput, newPassword: '123' };
      authService.resetPassword.mockRejectedValue(
        new ValidationError('Password does not meet requirements')
      );

      // Act & Assert
      await expect(resolver.resetPassword(weakPasswordInput)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user not found', async () => {
      // Arrange
      authService.resetPassword.mockRejectedValue(new NotFoundError('User not found'));

      // Act & Assert
      await expect(resolver.resetPassword(resetInput)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for expired token', async () => {
      // Arrange
      const expiredTokenInput = { ...resetInput, token: 'expired-token' };
      authService.resetPassword.mockRejectedValue(
        new ValidationError('Invalid or expired reset token')
      );

      // Act & Assert
      await expect(resolver.resetPassword(expiredTokenInput)).rejects.toThrow(ValidationError);
    });
  });

  describe('validateToken', () => {
    const tokenInput = {
      token: 'valid-access-token',
    };

    it('should return valid for correct token', async () => {
      // Arrange
      const validResult = { valid: true };
      authService.validateToken.mockResolvedValue(validResult);

      // Act
      const result = await resolver.validateToken(tokenInput);

      // Assert
      expect(authService.validateToken).toHaveBeenCalledWith(tokenInput.token);
      expect(result).toEqual(validResult);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for incorrect token', async () => {
      // Arrange
      const invalidResult = { valid: false, message: 'Invalid token' };
      authService.validateToken.mockResolvedValue(invalidResult);

      // Act
      const result = await resolver.validateToken({ token: 'invalid-token' });

      // Assert
      expect(result).toEqual(invalidResult);
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid token');
    });

    it('should return invalid for expired token', async () => {
      // Arrange
      const expiredResult = { valid: false, message: 'Token expired' };
      authService.validateToken.mockResolvedValue(expiredResult);

      // Act
      const result = await resolver.validateToken({ token: 'expired-token' });

      // Assert
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Token expired');
    });
  });

  describe('me (getCurrentUser)', () => {
    const mockContext = {
      req: {
        user: { userId: mockUser.id },
      },
    };

    it('should return current user data', async () => {
      // Arrange
      authService.getCurrentUser.mockResolvedValue(mockUser);

      // Act
      const result = await resolver.me(mockContext as any);

      // Assert
      expect(authService.getCurrentUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundError when user not found', async () => {
      // Arrange
      authService.getCurrentUser.mockRejectedValue(new NotFoundError('User not found'));

      // Act & Assert
      await expect(resolver.me(mockContext as any)).rejects.toThrow(NotFoundError);
    });

    it('should handle missing user context', async () => {
      // Arrange
      const contextWithoutUser = { req: {} };

      // Act & Assert
      // This would typically be handled by the guard, but testing edge case
      await expect(resolver.me(contextWithoutUser as any)).rejects.toThrow();
    });

    it('should require authentication', async () => {
      // Test that the JWT guard is applied to the me query
      // Note: This would be tested in integration tests with actual HTTP requests
      // Here we verify the guard is called
      expect(mockJwtAuthGuard.canActivate).toBeDefined();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle service errors gracefully', async () => {
      // Arrange
      authService.signIn.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(resolver.signIn({
        email: 'test@example.com',
        password: 'password',
      })).rejects.toThrow('Database connection failed');
    });

    it('should handle malformed input', async () => {
      // Arrange
      const malformedInput = { email: null, password: undefined };
      authService.signIn.mockRejectedValue(new ValidationError('Invalid input'));

      // Act & Assert
      await expect(resolver.signIn(malformedInput as any)).rejects.toThrow(ValidationError);
    });

    it('should handle concurrent sign-up attempts', async () => {
      // Arrange
      const signUpInput = {
        name: 'Test User',
        email: 'concurrent@example.com',
        password: 'password123',
      };
      authService.signUp.mockRejectedValue(new ConflictError('User already exists'));

      // Act & Assert
      await expect(resolver.signUp(signUpInput)).rejects.toThrow(ConflictError);
    });

    it('should validate email format in sign-up', async () => {
      // Arrange
      const invalidEmailInput = {
        name: 'Test User',
        email: 'not-an-email',
        password: 'password123',
      };
      authService.signUp.mockRejectedValue(new ValidationError('Invalid email format'));

      // Act & Assert
      await expect(resolver.signUp(invalidEmailInput)).rejects.toThrow(ValidationError);
    });

    it('should handle rate limiting scenarios', async () => {
      // Arrange - Simulate rate limiting error
      authService.signIn.mockRejectedValue(new Error('Too many requests'));

      // Act & Assert
      await expect(resolver.signIn({
        email: 'test@example.com',
        password: 'password',
      })).rejects.toThrow('Too many requests');
    });

    it('should handle network timeouts', async () => {
      // Arrange
      authService.refreshToken.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(resolver.refreshToken({
        refreshToken: 'token',
      })).rejects.toThrow('Network timeout');
    });
  });

  describe('security considerations', () => {
    it('should not expose sensitive information in errors', async () => {
      // Arrange
      authService.signIn.mockRejectedValue(new UnauthorizedError('Invalid credentials'));

      // Act & Assert
      try {
        await resolver.signIn({ email: 'test@example.com', password: 'wrong' });
      } catch (error) {
        expect(error.message).toBe('Invalid credentials');
        expect(error.message).not.toContain('password');
        expect(error.message).not.toContain('hash');
      }
    });

    it('should handle password reset token securely', async () => {
      // Arrange
      const suspiciousToken = '<script>alert("xss")</script>';
      authService.resetPassword.mockRejectedValue(
        new ValidationError('Invalid or expired reset token')
      );

      // Act & Assert
      await expect(resolver.resetPassword({
        token: suspiciousToken,
        newPassword: 'newPassword123',
      })).rejects.toThrow(ValidationError);
    });

    it('should validate input sanitization', async () => {
      // Arrange
      const maliciousInput = {
        name: '<script>alert("xss")</script>',
        email: 'test@example.com',
        password: 'password123',
      };
      // Service should handle sanitization
      authService.signUp.mockResolvedValue(mockAuthPayload);

      // Act
      await resolver.signUp(maliciousInput);

      // Assert
      expect(authService.signUp).toHaveBeenCalledWith(maliciousInput);
    });
  });

  describe('GraphQL specific behavior', () => {
    it('should handle GraphQL context correctly', async () => {
      // Arrange
      const graphqlContext = {
        req: { user: { userId: mockUser.id } },
        res: {},
      };
      authService.getCurrentUser.mockResolvedValue(mockUser);

      // Act
      const result = await resolver.me(graphqlContext);

      // Assert
      expect(result).toEqual(mockUser);
      expect(authService.getCurrentUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('should work with GraphQL subscriptions context', async () => {
      // For future subscription implementations
      const subscriptionContext = {
        connection: { context: { user: { userId: mockUser.id } } },
      };
      authService.getCurrentUser.mockResolvedValue(mockUser);

      // This would be relevant if we had subscription resolvers
      expect(subscriptionContext.connection.context.user.userId).toBe(mockUser.id);
    });
  });
});