import {
  BadRequestException,
  Body,
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
import type { Request, Response } from 'express';
import { sendFile } from '../storage/send-file';
import { JwtHttpAuthGuard } from '../../common/guards/jwt-http-auth.guard';
import { toHttpError } from '../../common/exceptions/to-http-error';
import { StatementImport } from './dto/statement.dto';
import {
  MAX_STATEMENT_BYTES,
  StatementsService,
  UploadedStatementFile,
} from './statements.service';

/**
 * Statement upload and download are REST (binary). Everything else about
 * statements (status polling, review, confirmation) is GraphQL.
 *
 *   curl -H "Authorization: Bearer $TOKEN" -F accountId=<card id> \
 *        -F file=@statement.pdf https://api.<domain>/statements
 *   curl -H "Authorization: Bearer $TOKEN" -o statement.pdf \
 *        https://api.<domain>/statements/<id>/file
 */
@Controller('statements')
@UseGuards(JwtHttpAuthGuard)
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Post()
  @HttpCode(202)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_STATEMENT_BYTES } }),
  )
  async upload(
    @Req() req: Request & { user: { id: string } },
    @Body('accountId') accountId: string | undefined,
    @UploadedFile() file: UploadedStatementFile | undefined,
  ): Promise<StatementImport> {
    if (!file) throw new BadRequestException('Missing `file` field');
    if (!accountId) throw new BadRequestException('Missing `accountId` field');

    try {
      return await this.statements.upload(req.user.id, accountId, file);
    } catch (error) {
      throw toHttpError(error);
    }
  }

  /** Streams the PDF to its owner; the file is never exposed from S3 directly. */
  @Get(':id/file')
  async download(
    @Req() req: Request & { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const file = await this.statements.openFile(id, req.user.id);
      sendFile(res, file, {
        fileName: `estado-de-cuenta-${id}.pdf`,
        contentType: 'application/pdf',
      });
    } catch (error) {
      throw toHttpError(error);
    }
  }
}
