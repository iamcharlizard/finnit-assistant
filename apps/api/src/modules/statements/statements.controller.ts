import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtHttpAuthGuard } from '../../common/guards/jwt-http-auth.guard';
import {
  ErrorCode,
  FinnitGraphQLError,
} from '../../common/exceptions/graphql-error.exception';
import { StatementImport } from './dto/statement.dto';
import {
  MAX_STATEMENT_BYTES,
  StatementsService,
  UploadedStatementFile,
} from './statements.service';

/**
 * Statement upload is REST because it is multipart. Everything else about
 * statements (status polling, review, confirmation) is GraphQL.
 *
 *   curl -H "Authorization: Bearer $TOKEN" -F accountId=<card id> \
 *        -F file=@statement.pdf https://api.<domain>/statements
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
}

/** The services throw GraphQL errors; map them to HTTP for this controller. */
function toHttpError(error: unknown): unknown {
  if (!(error instanceof FinnitGraphQLError)) return error;
  switch (error.extensions.code) {
    case ErrorCode.NOT_FOUND:
      return new NotFoundException(error.message);
    case ErrorCode.CONFLICT:
      return new ConflictException(error.message);
    default:
      return new BadRequestException(error.message);
  }
}
