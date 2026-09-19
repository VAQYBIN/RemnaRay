import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile('prisma/migrations/0001_init/migration.sql', 'utf8');
const schema = await readFile('prisma/schema.prisma', 'utf8');

test('initial migration includes the required tables and immutable triggers', () => {
  for (const table of [
    'settings',
    'users',
    'panel_users',
    'plans',
    'subscriptions',
    'accounts',
    'ledger_entries',
    'transactions',
    'invoices',
    'payment_events',
    'payment_providers',
    'promocodes',
    'admins',
    'audit_log',
    'notification_log',
    'broadcasts',
    'outbox_jobs',
    'setup_state',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}\\b`));
  }
  assert.match(migration, /CREATE OR REPLACE FUNCTION forbid_mutation/);
  assert.match(migration, /CREATE TRIGGER ledger_entries_immutable/);
  assert.match(migration, /CREATE TRIGGER transactions_guard/);
});

test('Prisma uses the Prisma 7 client generator and explicit output', () => {
  assert.match(schema, /provider = "prisma-client"/);
  assert.match(schema, /output\s+=\s+"\.\.\/src\/generated\/prisma"/);
  assert.match(schema, /uuidv7\(\)/);
});
