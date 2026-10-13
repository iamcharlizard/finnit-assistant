import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode, FinnitGraphQLError } from './graphql-error.exception';

/** Services throw GraphQL errors; REST controllers map them to HTTP ones. */
export function toHttpError(error: unknown): unknown {
  if (!(error instanceof FinnitGraphQLError)) return error;
  switch (error.extensions.code) {
    case ErrorCode.NOT_FOUND:
      return new NotFoundException(error.message);
    case ErrorCode.CONFLICT:
      return new ConflictException(error.message);
    case ErrorCode.FORBIDDEN:
      return new ForbiddenException(error.message);
    default:
      return new BadRequestException(error.message);
  }
}
