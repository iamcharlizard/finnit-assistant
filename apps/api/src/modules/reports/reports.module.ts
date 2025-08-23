import { Module } from '@nestjs/common';
import { ReportsResolver } from './reports.resolver';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../services/prisma.service';

@Module({
  providers: [ReportsResolver, ReportsService, PrismaService],
})
export class ReportsModule {}