import { Module } from '@nestjs/common';

import { DuplicatesResolver } from './duplicates.resolver';
import { DuplicatesService } from './duplicates.service';

/** The same money recorded twice: candidates, suggestions and merging. */
@Module({
  providers: [DuplicatesResolver, DuplicatesService],
  exports: [DuplicatesService],
})
export class DuplicatesModule {}
