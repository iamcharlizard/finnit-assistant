import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';

/** Liveness/readiness probe used by the Docker HEALTHCHECK and Dokploy. */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database unreachable');
    }
    return { status: 'ok' };
  }
}
