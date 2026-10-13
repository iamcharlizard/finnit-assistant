import {
  BadRequestException,
  Controller,
  Get,
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
import type { Request, Response } from 'express';
import { JwtHttpAuthGuard } from '../../common/guards/jwt-http-auth.guard';
import { toHttpError } from '../../common/exceptions/to-http-error';
import { Attachment } from '../../common/types/models/attachment.model';
import { sendFile } from '../storage/send-file';
import {
  MAX_ATTACHMENT_BYTES,
  TransactionsService,
} from './transactions.service';

type AuthedRequest = Request & { user: { id: string } };

/**
 * Transaction attachments (receipts, invoices, payment proofs). Files are in
 * the private S3 bucket; only the owner of the transaction can upload, list
 * (GraphQL `transaction.attachments`) or download them.
 *
 *   curl -H "Authorization: Bearer $TOKEN" -F file=@ticket.jpg \
 *        https://api.<domain>/transactions/<id>/attachments
 *   curl -H "Authorization: Bearer $TOKEN" -o ticket.jpg \
 *        https://api.<domain>/attachments/<id>/file
 */
@Controller()
@UseGuards(JwtHttpAuthGuard)
export class AttachmentsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post('transactions/:id/attachments')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  async upload(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @UploadedFile()
    file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ): Promise<Attachment> {
    if (!file) throw new BadRequestException('Missing `file` field');
    try {
      return await this.transactions.uploadAttachment(
        req.user.id,
        transactionId,
        file,
      );
    } catch (error) {
      throw toHttpError(error);
    }
  }

  @Get('attachments/:id/file')
  async download(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { file, fileName, fileType } =
        await this.transactions.openAttachment(id, req.user.id);
      sendFile(res, file, { fileName, contentType: fileType });
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
