import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const IMAGE = 'remnaray/backup:test';
const SCRIPTS = resolve(process.cwd(), 'deploy/backup');

function docker(args, { expectSuccess = true } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (expectSuccess && result.status !== 0)
    throw new Error(`docker ${args.join(' ')} failed with ${String(result.status)}:\n${output}`);
  return output;
}

/** Runs the entrypoint against the host network so it reaches the container. */
function backup(subcommand, directory, environment = []) {
  const variables = environment.flatMap((entry) => ['-e', entry]);
  return docker([
    'run',
    '--rm',
    '--network',
    'host',
    '-v',
    `${SCRIPTS}:/scripts:ro`,
    '-v',
    `${directory}:/backups`,
    ...variables,
    IMAGE,
    subcommand,
  ]);
}

test(
  'TASK-M5-006 / AC-202: a dump is written and the 14/8 retention holds',
  { timeout: 600_000 },
  async () => {
    docker(['build', '-f', 'deploy/backup/Dockerfile', '-t', IMAGE, '.']);

    const postgres = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('remnaray')
      .withUsername('remnaray')
      .withPassword('remnaray')
      .start();
    const directory = mkdtempSync(join(tmpdir(), 'rr-backups-'));

    try {
      execFileSync('pnpm', ['--filter', '@remnaray/db', 'db:migrate:deploy'], {
        env: { ...process.env, DATABASE_URL: postgres.getConnectionUri() },
        stdio: 'pipe',
      });

      // --- a dump is created (AC-202, first half) ---
      const environment = [
        `POSTGRES_HOST=${postgres.getHost()}`,
        `PGPORT=${String(postgres.getMappedPort(5432))}`,
        'POSTGRES_USER=remnaray',
        'POSTGRES_DB=remnaray',
        'POSTGRES_PASSWORD=remnaray',
      ];
      backup('once', directory, environment);

      const dumps = readdirSync(directory).filter((name) => /^remnaray-\d/u.test(name));
      assert.equal(dumps.length, 1, `expected one dump, got ${dumps.join(', ')}`);
      const dump = join(directory, dumps[0]);
      assert.ok(readFileSync(dump).length > 1000, 'the dump must not be empty');

      const status = readFileSync(join(directory, '.last-status'), 'utf8').trim().split(/\s+/u);
      assert.equal(status[0], 'ok');
      assert.equal(status[2], dumps[0]);
      assert.ok(Number(status[3]) > 1000, 'the status must carry the size');

      // The restore of section 20.5 reads it back into a clean database.
      const restored = docker(
        [
          'run',
          '--rm',
          '--network',
          'host',
          '-v',
          `${directory}:/backups`,
          '-e',
          'PGPASSWORD=remnaray',
          'postgres:18-alpine',
          'pg_restore',
          '--host',
          postgres.getHost(),
          '--port',
          String(postgres.getMappedPort(5432)),
          '--username',
          'remnaray',
          '--dbname',
          'remnaray',
          '--clean',
          '--if-exists',
          `/backups/${dumps[0]}`,
        ],
        { expectSuccess: false },
      );
      assert.ok(!/error:/iu.test(restored.replace(/^.*does not exist.*$/gmu, '')), restored);

      const tables = execFileSync(
        'docker',
        [
          'run',
          '--rm',
          '--network',
          'host',
          '-e',
          'PGPASSWORD=remnaray',
          'postgres:18-alpine',
          'psql',
          '--host',
          postgres.getHost(),
          '--port',
          String(postgres.getMappedPort(5432)),
          '--username',
          'remnaray',
          '--dbname',
          'remnaray',
          '-tAc',
          "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
        ],
        { encoding: 'utf8' },
      ).trim();
      assert.ok(Number(tables) > 20, `expected the schema back, saw ${tables} tables`);

      // --- rotation keeps 14 daily and 8 weekly (AC-202, second half) ---
      for (let day = 1; day <= 30; day += 1) {
        const stamp = `202601${String(day).padStart(2, '0')}-0300`;
        writeFileSync(join(directory, `remnaray-${stamp}.dump`), 'x');
        writeFileSync(join(directory, `files-${stamp}.tar.gz`), 'x');
      }
      for (let week = 1; week <= 12; week += 1)
        writeFileSync(
          join(directory, `remnaray-weekly-2026${String(week).padStart(4, '0')}-0300.dump`),
          'x',
        );

      backup('rotate', directory);

      const remaining = readdirSync(directory);
      assert.equal(remaining.filter((name) => /^remnaray-\d/u.test(name)).length, 14);
      assert.equal(remaining.filter((name) => name.startsWith('remnaray-weekly-')).length, 8);
      assert.equal(remaining.filter((name) => name.startsWith('files-')).length, 14);

      // The newest survive and the oldest go: the real dump taken above is the
      // most recent of all, and the first fixtures are gone.
      const daily = remaining.filter((name) => /^remnaray-\d/u.test(name)).sort();
      assert.equal(daily.at(-1), dumps[0], `kept the newest: ${daily.join(', ')}`);
      assert.ok(daily.includes('remnaray-20260130-0300.dump'), daily.join(', '));
      assert.ok(!daily.includes('remnaray-20260101-0300.dump'), daily.join(', '));
      assert.ok(!daily.includes('remnaray-20260117-0300.dump'), daily.join(', '));
      process.stdout.write(`backup rotation kept ${String(daily.length)} daily and 8 weekly\n`);
    } finally {
      await postgres.stop();
    }
  },
);
