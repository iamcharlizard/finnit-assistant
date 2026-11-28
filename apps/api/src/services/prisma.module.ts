import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * One PrismaClient for the whole app. Never list PrismaService in a feature
 * module's providers: every module that does gets its own client, with its
 * own connection pool and its own copy of Prisma's query schema in memory
 * (tens of MB each), which once took the API past its memory limit.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
