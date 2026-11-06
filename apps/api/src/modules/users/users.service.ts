import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { UpdateMyPreferencesInput, UpdateMyProfileInput } from './dto/user.dto';
import { ValidationError } from '../../common/exceptions/graphql-error.exception';
import { User, toUserModel } from '../../common/types/models/user.model';
import { isAppLocale } from '../translation/locale';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Only the fields listed here are written, never the raw input. */
  async updateProfile(id: string, input: UpdateMyProfileInput): Promise<User> {
    const name = input.name?.trim();
    if (name !== undefined && (name.length < 2 || name.length > 50)) {
      throw new ValidationError('Name must be 2 to 50 characters');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...(name !== undefined && { name }) },
    });
    return toUserModel(user);
  }

  async updatePreferences(
    id: string,
    input: UpdateMyPreferencesInput,
  ): Promise<User> {
    if (input.locale !== undefined && !isAppLocale(input.locale)) {
      throw new ValidationError("Locale must be 'es' or 'en'");
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...(input.locale && { locale: input.locale }) },
    });
    return toUserModel(user);
  }
}
