import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Migration 0007 on a real PostgreSQL: the store's `fiscal.mode` values
 * `receipt` and `manual` become FR-062's `provider_receipt` and `none`, in the
 * settings and in a wizard's saved payments step, and the settings schema
 * accepts what the migration leaves. Left alone, the schema would refuse
 * `receipt` and the settings would fall back to `none`: receipts off, silently.
 */
test(
  'M1 migration 0007 maps fiscal.mode to the FR-062 vocabulary',
  { timeout: 180_000 },
  async () => {
    const postgres = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('remnaray')
      .withUsername('remnaray')
      .withPassword('remnaray')
      .start();
    let prisma;
    try {
      execFileSync('pnpm', ['--filter', '@remnaray/db', 'db:migrate:deploy'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: postgres.getConnectionUri() },
        stdio: 'pipe',
      });
      const { createPrismaClient } = await import('../packages/db/dist/index.js');
      const { settingDefinitions } =
        await import('../apps/api/dist/modules/settings/settings.schemas.js');
      prisma = createPrismaClient(postgres.getConnectionUri());
      const sql = await readFile(
        'packages/db/prisma/migrations/0007_fiscal_mode_provider_receipt/migration.sql',
        'utf8',
      );
      const run = async () => {
        for (const statement of sql
          .replaceAll(/^--.*$/gmu, '')
          .split(';')
          .map((part) => part.trim())
          .filter(Boolean))
          await prisma.$executeRawUnsafe(statement);
      };
      const mode = async () =>
        (await prisma.setting.findUniqueOrThrow({ where: { key: 'fiscal.mode' } })).value;
      const schema = settingDefinitions.get('fiscal.mode').schema;

      // What the old wizard wrote for "I am self-employed".
      await prisma.setting.create({ data: { key: 'fiscal.mode', value: 'receipt' } });
      await prisma.setupState.upsert({
        where: { id: 1 },
        create: { id: 1, data: { payments: { fiscal: { mode: 'receipt', sno: 'npd' } } } },
        update: { data: { payments: { fiscal: { mode: 'receipt', sno: 'npd' } } } },
      });
      assert.equal(schema.safeParse(await mode()).success, false, 'the new schema refuses it');
      await run();
      assert.equal(await mode(), 'provider_receipt');
      assert.equal(schema.safeParse(await mode()).success, true);
      const state = await prisma.setupState.findUniqueOrThrow({ where: { id: 1 } });
      assert.deepEqual(state.data.payments.fiscal, { mode: 'provider_receipt', sno: 'npd' });

      await prisma.setting.update({ where: { key: 'fiscal.mode' }, data: { value: 'manual' } });
      await run();
      assert.equal(await mode(), 'none');

      // Running it again changes nothing.
      await prisma.setting.update({
        where: { key: 'fiscal.mode' },
        data: { value: 'provider_receipt' },
      });
      await run();
      assert.equal(await mode(), 'provider_receipt');
    } finally {
      await prisma?.$disconnect();
      await postgres.stop();
    }
  },
);
