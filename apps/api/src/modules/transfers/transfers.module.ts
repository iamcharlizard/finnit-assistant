import { Module } from '@nestjs/common';
import { TransfersResolver } from './transfers.resolver';
import { TransfersService } from './transfers.service';
import { PrismaService } from '../../services/prisma.service';

@Module({
  providers: [TransfersResolver, TransfersService, PrismaService],
})
export class TransfersModule {}