import { Module } from '@nestjs/common';
import { TransactionsResolver } from './transactions.resolver';
import { TransactionsService } from './transactions.service';
import { TransferDirectionLoader } from './transfer-direction.loader';
import { AttachmentsController } from './attachments.controller';
import { StorageModule } from '../storage/storage.module';
import { CategorizationModule } from '../categorization/categorization.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { DuplicatesModule } from '../duplicates/duplicates.module';

@Module({
  imports: [
    StorageModule,
    CategorizationModule,
    PrivacyModule,
    DuplicatesModule,
  ],
  controllers: [AttachmentsController],
  providers: [
    TransactionsResolver,
    TransactionsService,
    TransferDirectionLoader,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
