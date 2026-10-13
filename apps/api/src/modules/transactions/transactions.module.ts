import { Module } from '@nestjs/common';
import { TransactionsResolver } from './transactions.resolver';
import { TransactionsService } from './transactions.service';
import { AttachmentsController } from './attachments.controller';
import { PrismaService } from '../../services/prisma.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [AttachmentsController],
  providers: [TransactionsResolver, TransactionsService, PrismaService],
})
export class TransactionsModule {}
