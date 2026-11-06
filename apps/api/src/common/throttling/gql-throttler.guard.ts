import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TooManyRequestsError } from '../exceptions/graphql-error.exception';
import { clientIp } from './client-ip';

/**
 * Rate limit for the public GraphQL operations (sign-in, password reset,
 * waitlist). Signed-in operations are not throttled: they need a token.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context).getContext<{
      req: Record<string, any>;
      res: Record<string, any>;
    }>();
    return { req: ctx.req, res: ctx.res };
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(clientIp(req));
  }

  protected throwThrottlingException(): Promise<void> {
    throw new TooManyRequestsError();
  }
}
