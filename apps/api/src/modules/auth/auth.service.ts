import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../services/prisma.service';
import {
  SignUpInput,
  SignInInput,
  AuthPayload,
  User,
  RefreshTokenInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  TokenValidationResult,
} from './dto/auth.dto';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '../../common/exceptions/graphql-error.exception';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(input: SignUpInput): Promise<AuthPayload> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
    });

    // Create default categories for the user
    await this.createDefaultCategories(user.id);

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async signIn(input: SignInInput): Promise<AuthPayload> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async refreshToken(input: RefreshTokenInput): Promise<AuthPayload> {
    try {
      const payload = this.jwtService.verify(input.refreshToken);
      
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      const { accessToken, refreshToken } = this.generateTokens(user.id, user.email);

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  async requestPasswordReset(input: RequestPasswordResetInput): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      // Don't reveal if user exists or not
      return true;
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token (you would need to add a password_reset_tokens table)
    // For now, we'll encode the token with expiration and user ID
    const payload = {
      userId: user.id,
      exp: Math.floor(expiresAt.getTime() / 1000),
    };
    
    const resetTokenJWT = this.jwtService.sign(payload, { expiresIn: '15m' });
    
    // TODO: Send email with reset link containing the resetTokenJWT
    // await this.emailService.sendPasswordResetEmail(user.email, resetTokenJWT);
    
    console.log(`Password reset token for ${user.email}: ${resetTokenJWT}`);
    
    return true;
  }

  async resetPassword(input: ResetPasswordInput): Promise<boolean> {
    try {
      // Verify the reset token
      const payload = this.jwtService.verify(input.token);
      
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Hash the new password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(input.newPassword, saltRounds);

      // Update the user's password
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
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
      const payload = this.jwtService.verify(token);
      
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        return {
          valid: false,
          message: 'User not found',
        };
      }

      return {
        valid: true,
      };
    } catch (error) {
      return {
        valid: false,
        message: 'Invalid token',
      };
    }
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });
    
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  private async createDefaultCategories(userId: string): Promise<void> {
    const defaultCategories = [
      // Expenses
      { name: 'Food & Dining', children: ['Groceries', 'Restaurants', 'Coffee & Snacks'] },
      { name: 'Transportation', children: ['Gas', 'Public Transit', 'Parking', 'Car Maintenance'] },
      { name: 'Shopping', children: ['Clothing', 'Electronics', 'Books', 'General'] },
      { name: 'Bills & Utilities', children: ['Electricity', 'Water', 'Internet', 'Phone', 'Insurance'] },
      { name: 'Entertainment', children: ['Movies', 'Sports', 'Hobbies', 'Subscriptions'] },
      { name: 'Health & Medical', children: ['Doctor', 'Pharmacy', 'Fitness', 'Insurance'] },
      { name: 'Education', children: ['Tuition', 'Books', 'Supplies'] },
      { name: 'Personal Care', children: ['Hair', 'Beauty', 'Clothing'] },
      
      // Income
      { name: 'Income', children: ['Salary', 'Freelance', 'Investments', 'Other Income'] },
      
      // Other
      { name: 'Uncategorized', children: [] },
    ];

    for (let i = 0; i < defaultCategories.length; i++) {
      const parent = defaultCategories[i];
      
      const parentCategory = await this.prisma.category.create({
        data: {
          userId,
          name: parent.name,
          sortOrder: i + 1,
          isDefault: false,
        },
      });

      // Create child categories
      for (let j = 0; j < parent.children.length; j++) {
        await this.prisma.category.create({
          data: {
            userId,
            parentId: parentCategory.id,
            name: parent.children[j],
            sortOrder: j + 1,
            isDefault: false,
          },
        });
      }
    }
  }
}