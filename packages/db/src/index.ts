import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.js';

export type { PrismaClient } from './generated/prisma/client.js';
export { Prisma } from './generated/prisma/client.js';
export { ReferralStatus } from './generated/prisma/enums.js';

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  return new PrismaClient({ adapter });
}
