import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { GqlThrottlerGuard } from '../../common/throttling/gql-throttler.guard';
import { limits } from '../../common/throttling/throttling';
import { WaitlistService } from './waitlist.service';
import {
  JoinWaitlistInput,
  JoinWaitlistResult,
  WaitlistEntriesArgs,
  WaitlistEntryConnection,
} from './dto/waitlist.dto';

/** Waitlist of the public landing page. */
@Resolver()
export class WaitlistResolver {
  constructor(private readonly waitlist: WaitlistService) {}

  @UseGuards(GqlThrottlerGuard)
  @Throttle(limits(5, 3))
  @Mutation(() => JoinWaitlistResult, {
    description:
      'Public (no sign-in): adds an email to the waitlist. Rate-limited.',
  })
  async joinWaitlist(
    @Args('input') input: JoinWaitlistInput,
  ): Promise<JoinWaitlistResult> {
    return this.waitlist.join(input);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Query(() => WaitlistEntryConnection, { description: 'Admin only' })
  async waitlistEntries(
    @Args() args: WaitlistEntriesArgs,
  ): Promise<WaitlistEntryConnection> {
    return this.waitlist.list(args);
  }
}
