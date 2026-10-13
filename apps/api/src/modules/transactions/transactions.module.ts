import { Module } from '@nestjs/common';
import { TransactionsResolver } from './transactions.resolver';
import { TransactionsService } from './transactions.service';
import { TransferDirectionLoader } from './transfer-direction.loader';
import { AttachmentsController } from './attachments.controller';
import { PrismaService } from '../../services/prisma.service';
import { StorageModule } from '../storage/storage.module';
import { CategorizationModule } from '../categorization/categorization.module';

@Module({
  imports: [StorageModule, CategorizationModule],
  controllers: [AttachmentsController],
  providers: [
    TransactionsResolver,
    TransactionsService,
    TransferDirectionLoader,
    PrismaService,
  ],
})
export class TransactionsModule {}
