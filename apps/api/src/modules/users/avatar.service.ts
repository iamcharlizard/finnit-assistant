import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { User, toUserModel } from '../../common/types/models/user.model';
import {
  S3StorageService,
  type StoredObject,
} from '../storage/s3-storage.service';
import { detectFileType } from '../storage/file-type.util';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * The profile photo the user uploads (it wins over their Google picture).
 * Stored in the private bucket under users/<id>/avatars/; only its owner
 * gets it back, through GET /me/avatar.
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
  ) {}

  async upload(
    userId: string,
    file: { buffer: Buffer; size: number },
  ): Promise<User> {
    if (file.size > MAX_AVATAR_BYTES) {
      throw new ValidationError('The photo exceeds 2 MB');
    }
    const type = detectFileType(file.buffer);
    if (!type || !AVATAR_TYPES.has(type.mime)) {
      throw new ValidationError('Only JPEG, PNG or WEBP photos are allowed');
    }
    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true },
    });
    if (!previous) throw new NotFoundError('User not found');

    const key = S3StorageService.key(
      userId,
      'avatars',
      randomUUID(),
      type.extension,
    );
    await this.storage.put(key, file.buffer, type.mime);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: key, avatarUpdatedAt: new Date() },
    });
    if (previous.avatarKey) await this.deleteQuietly(previous.avatarKey);
    return toUserModel(user);
  }

  /** Back to the Google picture, or to initials. */
  async remove(userId: string): Promise<User> {
    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true },
    });
    if (!previous) throw new NotFoundError('User not found');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: null, avatarUpdatedAt: new Date() },
    });
    if (previous.avatarKey) await this.deleteQuietly(previous.avatarKey);
    return toUserModel(user);
  }

  async open(
    userId: string,
  ): Promise<{ file: StoredObject; contentType: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true },
    });
    if (!user?.avatarKey) throw new NotFoundError('No profile photo');
    const file = await this.storage.open(user.avatarKey);
    const extension = user.avatarKey.split('.').pop();
    const contentType =
      extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    return { file, contentType };
  }

  private async deleteQuietly(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn(
        `Could not delete the old photo ${key}: ${(error as Error).message}`,
      );
    }
  }
}
