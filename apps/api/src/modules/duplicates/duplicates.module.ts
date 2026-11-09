import { Module } from '@nestjs/common';

import { PrismaService } from '../../services/prisma.service';
import { DuplicatesResolver } from './duplicates.resolver';
import { DuplicatesService } from './duplicates.service';

/** The same money recorded twice: candidates, suggestions and merging. */
@Module({
  providers: [DuplicatesResolver, DuplicatesService, PrismaService],
  exports: [DuplicatesService],
})
export class DuplicatesModule {}
