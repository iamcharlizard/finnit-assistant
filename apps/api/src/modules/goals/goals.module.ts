import { Module } from '@nestjs/common';
import { GoalsResolver } from './goals.resolver';
import { GoalsService } from './goals.service';
import { PrismaService } from '../../services/prisma.service';

@Module({
  providers: [GoalsResolver, GoalsService, PrismaService],
})
export class GoalsModule {}