import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.js';

export type { PrismaClient } from './generated/prisma/client.js';
export { Prisma } from './generated/prisma/client.js';

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL) {
  const adapter = new PrismaPg({
    connectionString: databaseUrl ?? 'postgresql://postgres:postgres@127.0.0.1:5432/remnaray',
  });

  return new PrismaClient({ adapter });
}
