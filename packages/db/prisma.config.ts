import { env as processEnv } from 'node:process';

import { defineConfig } from 'prisma/config';

const environment = processEnv as Record<string, string | undefined>;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: environment.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/remnaray',
  },
});
