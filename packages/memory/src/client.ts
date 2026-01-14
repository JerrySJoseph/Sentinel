import { PrismaClient } from '@prisma/client';

export type CreatePrismaClientOptions = {
  databaseUrl?: string;
  log?: Array<'query' | 'info' | 'warn' | 'error'>;
};

export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  const { databaseUrl, log } = options;
  return new PrismaClient({
    log,
    datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
  });
}
