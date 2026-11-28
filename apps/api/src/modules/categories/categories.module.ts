import { Module } from '@nestjs/common';
import { CategoriesResolver } from './categories.resolver';
import { CategoriesService } from './categories.service';
import { CategoryI18nLoader } from './category-names';
import { CategoryCatalogService } from './category-catalog.service';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [TranslationModule],
  providers: [
    CategoriesResolver,
    CategoriesService,
    CategoryI18nLoader,
    CategoryCatalogService,
  ],
  exports: [CategoriesService, CategoryI18nLoader],
})
export class CategoriesModule {}
