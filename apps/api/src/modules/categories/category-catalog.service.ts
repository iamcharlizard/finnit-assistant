import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { syncCategoryCatalog } from '../auth/default-categories';

/**
 * Keeps the global category catalog in step with default-categories.ts on
 * every start (creates and updates by key, never deletes).
 */
@Injectable()
export class CategoryCatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CategoryCatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const created = await syncCategoryCatalog(this.prisma);
      if (created > 0) {
        this.logger.log(`Category catalog: ${created} new categories`);
      }
    } catch (error) {
      // Never keeps the API from starting; the catalog stays as it was.
      this.logger.error(
        `Category catalog sync failed: ${(error as Error).message}`,
      );
    }
  }
}
