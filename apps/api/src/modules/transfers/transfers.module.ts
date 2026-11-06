import { Module } from '@nestjs/common';
import { TransfersResolver } from './transfers.resolver';
import { TransfersService } from './transfers.service';
import { TransferConversionService } from './transfer-conversion.service';
import { TransferSuggestionsService } from './transfer-suggestions.service';
import { PrismaService } from '../../services/prisma.service';
import { CategorizationModule } from '../categorization/categorization.module';

@Module({
  imports: [CategorizationModule],
  providers: [
    TransfersResolver,
    TransfersService,
    TransferConversionService,
    TransferSuggestionsService,
    PrismaService,
  ],
  exports: [TransferSuggestionsService],
})
export class TransfersModule {}
