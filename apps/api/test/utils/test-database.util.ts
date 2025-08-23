import { PrismaClient } from '@finnit/database';
import { execSync } from 'child_process';

export class TestDatabaseUtil {
  private static prisma: PrismaClient;

  static async setupTestDatabase(): Promise<PrismaClient> {
    if (!this.prisma) {
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });

      await this.prisma.$connect();
    }

    return this.prisma;
  }

  static async cleanDatabase(): Promise<void> {
    if (this.prisma) {
      const tablenames = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname='public'
      `;

      const tables = tablenames
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .map((name) => `"public"."${name}"`)
        .join(', ');

      try {
        await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
      } catch (error) {
        console.log({ error });
      }
    }
  }

  static async teardownTestDatabase(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  static getPrismaClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Run database migrations for testing
   */
  static async runMigrations(): Promise<void> {
    try {
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        cwd: '../../packages/database',
      });
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  /**
   * Reset and seed the test database
   */
  static async resetAndSeed(): Promise<void> {
    try {
      await this.cleanDatabase();
      // Add seeding logic here if needed
    } catch (error) {
      console.error('Failed to reset and seed database:', error);
      throw error;
    }
  }
}