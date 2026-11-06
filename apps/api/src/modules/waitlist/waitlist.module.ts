import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { WaitlistService } from './waitlist.service';
import { WaitlistResolver } from './waitlist.resolver';

@Module({
  providers: [WaitlistService, WaitlistResolver, PrismaService],
})
export class WaitlistModule {}
