import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ForbiddenError } from '../exceptions/graphql-error.exception';

/** Emails in ADMIN_EMAILS (comma-separated) may manage system settings. */
export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

/**
 * Allows only admins. Use after JwtAuthGuard so `req.user` is set:
 * `@UseGuards(JwtAuthGuard, AdminGuard)`.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = GqlExecutionContext.create(context).getContext<{
      req: { user?: { email?: string } };
    }>().req;
    if (!isAdminEmail(request.user?.email)) {
      throw new ForbiddenError('Only administrators can do this');
    }
    return true;
  }
}
