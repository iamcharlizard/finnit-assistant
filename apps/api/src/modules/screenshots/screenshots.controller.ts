import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ReceiptStatus } from '@finnit/database';
import type { Request, Response } from 'express';
import { JwtHttpAuthGuard } from '../../common/guards/jwt-http-auth.guard';
import { toHttpError } from '../../common/exceptions/to-http-error';
import { sendFile } from '../storage/send-file';
import {
  MAX_RECEIPT_BYTES,
  type UploadedReceiptFile,
} from '../receipts/receipts.service';
import { ScreenshotsService } from './screenshots.service';

type AuthedRequest = Request & { user: { id: string } };

/**
 * Screenshot upload and download are REST (binary). Status polling, review,
 * confirmation and discard are GraphQL (`screenshotImport`, …).
 *
 *   curl -H "Authorization: Bearer $TOKEN" -F file=@captura.png \
 *        https://api.<domain>/screenshots          → 202 {"id","status"}
 */
@Controller('screenshots')
@UseGuards(JwtHttpAuthGuard)
export class ScreenshotsController {
  constructor(private readonly screenshots: ScreenshotsService) {}

  @Post()
  @HttpCode(202)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_RECEIPT_BYTES } }),
  )
  async upload(
    @Req() req: AuthedRequest,
    @UploadedFile() file: UploadedReceiptFile | undefined,
  ): Promise<{ id: string; status: ReceiptStatus }> {
    if (!file) throw new BadRequestException('Missing `file` field');
    try {
      return await this.screenshots.upload(req.user.id, file);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  /** Streams the screenshot to its owner; it is never exposed from S3 directly. */
  @Get(':id/file')
  async download(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { file, fileName, mimeType } = await this.screenshots.openFile(
        id,
        req.user.id,
      );
      sendFile(res, file, { fileName, contentType: mimeType, inline: true });
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
