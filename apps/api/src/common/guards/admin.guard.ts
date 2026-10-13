import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ForbiddenError } from '../exceptions/graphql-error.exception';

interface RequestUser {
  role?: string;
  isMaster?: boolean;
}

function requestUser(context: ExecutionContext): RequestUser | undefined {
  return GqlExecutionContext.create(context).getContext<{
    req: { user?: RequestUser };
  }>().req.user;
}

/**
 * Allows only admins (User.role, read from the database on every request
 * by JwtStrategy). Use after JwtAuthGuard: `@UseGuards(JwtAuthGuard, AdminGuard)`.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (requestUser(context)?.role !== 'admin') {
      throw new ForbiddenError('Only administrators can do this');
    }
    return true;
  }
}

/** Allows only the master admin. Use after JwtAuthGuard. */
@Injectable()
export class MasterGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = requestUser(context);
    if (user?.role !== 'admin' || !user.isMaster) {
      throw new ForbiddenError('Only the master administrator can do this');
    }
    return true;
  }
}
