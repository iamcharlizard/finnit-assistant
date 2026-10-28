import { Module } from '@nestjs/common';
import { CategoriesResolver } from './categories.resolver';
import { CategoriesService } from './categories.service';
import { CategoryI18nLoader } from './category-names';
import { PrismaService } from '../../services/prisma.service';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [TranslationModule],
  providers: [
    CategoriesResolver,
    CategoriesService,
    CategoryI18nLoader,
    PrismaService,
  ],
  exports: [CategoriesService, CategoryI18nLoader],
})
export class CategoriesModule {}
