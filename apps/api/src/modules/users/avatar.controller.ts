import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JwtHttpAuthGuard } from '../../common/guards/jwt-http-auth.guard';
import { toHttpError } from '../../common/exceptions/to-http-error';
import { User } from '../../common/types/models/user.model';
import { sendFile } from '../storage/send-file';
import { AvatarService, MAX_AVATAR_BYTES } from './avatar.service';

type AuthedRequest = Request & { user: { id: string } };

/**
 * The signed-in user's profile photo.
 *
 *   curl -H "Authorization: Bearer $TOKEN" -F file=@me.webp https://api.<domain>/me/avatar
 *   curl -H "Authorization: Bearer $TOKEN" -o me.webp https://api.<domain>/me/avatar
 */
@Controller('me/avatar')
@UseGuards(JwtHttpAuthGuard)
export class AvatarController {
  constructor(private readonly avatars: AvatarService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_BYTES } }),
  )
  async upload(
    @Req() req: AuthedRequest,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ): Promise<User> {
    if (!file) throw new BadRequestException('Missing `file` field');
    try {
      return await this.avatars.upload(req.user.id, file);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  @Get()
  async download(
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { file, contentType } = await this.avatars.open(req.user.id);
      // Shown on every page: the URL carries ?v=<version>, so the private
      // browser cache may keep it.
      sendFile(res, file, {
        fileName: 'avatar',
        contentType,
        inline: true,
        cacheControl: 'private, max-age=86400',
      });
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
