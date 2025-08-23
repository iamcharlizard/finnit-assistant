import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { User, UpdateUserInput } from './dto/user.dto';
import { NotFoundError, ConflictError } from '../../common/exceptions/graphql-error.exception';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
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

  async update(id: string, input: UpdateUserInput): Promise<User> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Check if email is already taken by another user
    if (input.email && input.email !== existingUser.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: {
          email: input.email,
          id: { not: id },
        },
      });

      if (emailTaken) {
        throw new ConflictError('Email is already taken');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: input,
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }
}