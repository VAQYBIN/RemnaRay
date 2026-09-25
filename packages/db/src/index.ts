import { PrismaPg } from '@prisma/adapter-pg';

import { resolveDatabaseUrl } from './database-url.js';
import { PrismaClient } from './generated/prisma/client.js';

export type { PrismaClient } from './generated/prisma/client.js';
export { Prisma } from './generated/prisma/client.js';
export { ReferralStatus } from './generated/prisma/enums.js';
export { resolveDatabaseUrl } from './database-url.js';

export function createPrismaClient(databaseUrl = resolveDatabaseUrl()) {
  if (!databaseUrl) throw new Error('DATABASE_URL or POSTGRES_PASSWORD is required');
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  return new PrismaClient({ adapter });
}
