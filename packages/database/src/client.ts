import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';

const prismaClientSingleton = () => {
  const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
  });
  return new PrismaClient({ adapter });
};

declare const globalThis: {
  prisma: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
