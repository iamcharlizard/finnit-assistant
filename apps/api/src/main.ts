import './load-env';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind Dokploy's reverse proxy (one hop): req.ip is the caller's address,
  // which the rate limit uses. TRUST_PROXY_HOPS=0 when exposed directly.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));
  // Close Prisma connections cleanly when Docker stops the container.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

void bootstrap();
