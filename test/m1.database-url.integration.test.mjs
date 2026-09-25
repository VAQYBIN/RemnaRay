import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { URL } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * A PostgreSQL password with every character a URL or a dotenv file treats
 * specially. The owner types it into `init-env.sh` (26.4 A1); compose used to
 * paste it into DATABASE_URL raw, where `@`, `/` and `#` end the user info or
 * start the path, and `.env` expanded its `$` and cut it at ` #`.
 */
const PASSWORD = String.raw`p@ss:w/rd#x$y"z%2F ?&=\ #end`;

test(
  'M1 a password with URL and dotenv characters reaches PostgreSQL intact',
  { timeout: 180_000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), 'rr-init-env-'));
    const envFile = join(directory, '.env');
    const postgres = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('remnaray')
      .withUsername('remnaray')
      .withPassword('remnaray')
      .start();
    // Set afterwards: the container's own readiness check cannot carry it.
    const altered = await postgres.exec([
      'psql',
      '-U',
      'remnaray',
      '-d',
      'remnaray',
      '-c',
      `ALTER ROLE remnaray PASSWORD $rr$${PASSWORD}$rr$`,
    ]);
    assert.equal(altered.exitCode, 0, altered.output);
    let prisma;
    try {
      // --- init-env.sh writes it so compose reads it back unchanged ---
      execFileSync('sh', ['scripts/init-env.sh', envFile], {
        input: `shop.example.test\nops@example.test\n${PASSWORD}\n`,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // A deployment directory: `compose.yaml` beside its `.env`, which both
      // `env_file` and interpolation read.
      copyFileSync('compose.yaml', join(directory, 'compose.yaml'));
      symlinkSync(resolve('deploy'), join(directory, 'deploy'));
      const config = JSON.parse(
        execFileSync('docker', ['compose', 'config', '--format', 'json'], {
          cwd: directory,
          encoding: 'utf8',
        }),
      );
      // `config` writes every `$` of the result as `$$`.
      const literal = (value) => value.replaceAll('$$', '$');
      assert.equal(literal(config.services.postgres.environment.POSTGRES_PASSWORD), PASSWORD);
      // The application builds the URL itself: compose passes no assembled one.
      assert.equal(config.services.api.environment.DATABASE_URL, '');
      // The application containers get the password itself, from `env_file`.
      assert.equal(literal(config.services.api.environment.POSTGRES_PASSWORD), PASSWORD);

      // --- the application connects with the POSTGRES_* it is given ---
      const { createPrismaClient, resolveDatabaseUrl } =
        await import('../packages/db/dist/index.js');
      const environment = {
        POSTGRES_USER: 'remnaray',
        POSTGRES_PASSWORD: PASSWORD,
        POSTGRES_DB: 'remnaray',
        POSTGRES_HOST: postgres.getHost(),
        POSTGRES_PORT: String(postgres.getPort()),
      };
      const url = resolveDatabaseUrl(environment);

      // What compose used to assemble: the password pasted in raw.
      const raw = `postgresql://remnaray:${PASSWORD}@${environment.POSTGRES_HOST}:${environment.POSTGRES_PORT}/remnaray`;
      assert.notEqual(
        (() => {
          try {
            return decodeURIComponent(new URL(raw).password);
          } catch {
            return null;
          }
        })(),
        PASSWORD,
        'the raw URL does not carry the password',
      );

      prisma = createPrismaClient(url);
      const [row] = await prisma.$queryRaw`SELECT current_user AS "user"`;
      assert.equal(row.user, 'remnaray');

      // Prisma's own CLI, which `migrate` runs, reads the same URL.
      execFileSync('pnpm', ['--filter', '@remnaray/db', 'db:migrate:deploy'], {
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe',
      });
      const [{ count }] =
        await prisma.$queryRaw`SELECT count(*)::int AS count FROM _prisma_migrations`;
      assert.ok(count > 0);
    } finally {
      await prisma?.$disconnect();
      await postgres.stop();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('init-env.sh generates a password when none is typed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rr-init-env-'));
  try {
    const envFile = resolve(directory, '.env');
    execFileSync('sh', ['scripts/init-env.sh', envFile], {
      input: 'shop.example.test\nops@example.test\n\n',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert.match(readFileSync(envFile, 'utf8'), /^POSTGRES_PASSWORD='[0-9a-f]{48}'$/mu);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('init-env.sh refuses a password it cannot write literally', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rr-init-env-'));
  try {
    assert.throws(
      () =>
        execFileSync('sh', ['scripts/init-env.sh', join(directory, '.env')], {
          input: "shop.example.test\nops@example.test\nit's\n",
          stdio: ['pipe', 'pipe', 'pipe'],
        }),
      (error) => /single quote/u.test(String(error.stderr)),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
