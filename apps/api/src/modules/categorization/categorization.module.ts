import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { AiModule } from '../ai/ai.module';
import { CategorizationResolver } from './categorization.resolver';
import { CategorizationService } from './categorization.service';
import { MerchantAliasesResolver } from './merchant-aliases.resolver';
import { MerchantAliasesService } from './merchant-aliases.service';
import { MerchantRulesService } from './merchant-rules.service';

/** Merchant aliases (feature 17), merchant rules and category suggestions (feature 16). */
@Module({
  imports: [AiModule],
  providers: [
    MerchantAliasesService,
    MerchantAliasesResolver,
    MerchantRulesService,
    CategorizationService,
    CategorizationResolver,
    PrismaService,
  ],
  exports: [MerchantAliasesService, MerchantRulesService],
})
export class CategorizationModule {}
