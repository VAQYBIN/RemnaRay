import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { Buffer } from 'node:buffer';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';

const IMAGE = 'remnaray/nginx:test';
const TEMPLATES = resolve(process.cwd(), 'deploy/proxy');
const MODES = ['acme', 'certbot', 'custom'];

/** `nginx -t` reports on stderr, so both streams are returned together. */
function docker(args, { expectSuccess = true } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (expectSuccess && result.status !== 0)
    throw new Error(`docker ${args.join(' ')} failed with ${String(result.status)}:\n${output}`);
  return output;
}

/** `nginx -t` loads the certificate files, so the modes that name real paths need one. */
function selfSigned(directory) {
  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    join(directory, 'privkey.pem'),
    '-out',
    join(directory, 'fullchain.pem'),
    '-days',
    '2',
    '-subj',
    '/CN=shop.example.test',
  ]);
}

async function renderInto(output, mode, domain, databaseUrl, valkeyUrl, watch) {
  const child = spawn(
    'node',
    [
      'apps/api/dist/tools/render-proxy.js',
      '--profile',
      'nginx',
      '--tls',
      mode,
      '--templates',
      TEMPLATES,
      '--out',
      output,
      ...(watch ? ['--watch'] : []),
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        VALKEY_URL: valkeyUrl,
        RR_DOMAIN: domain,
        RR_ACME_EMAIL: 'ops@example.test',
      },
      stdio: 'pipe',
    },
  );
  const log = [];
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => log.push(String(chunk)));
  if (!watch) {
    const code = await new Promise((done) => child.on('exit', done));
    assert.equal(code, 0, log.join(''));
    return { log };
  }
  return { child, log };
}

test(
  'TASK-M5-002: the rendered nginx configuration is valid in every TLS mode',
  { timeout: 600_000 },
  async () => {
    docker(['build', '-f', 'deploy/proxy/nginx/Dockerfile', '-t', IMAGE, '.']);

    const modules = docker(['run', '--rm', IMAGE, 'ls', '/usr/lib/nginx/modules']);
    assert.match(modules, /ngx_http_acme_module\.so/u, 'the ACME module must be in the image');

    const postgres = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('remnaray')
      .withUsername('remnaray')
      .withPassword('remnaray')
      .start();
    const valkey = await new GenericContainer('valkey/valkey:9.1-alpine')
      .withExposedPorts(6379)
      .start();
    const databaseUrl = postgres.getConnectionUri();
    const valkeyUrl = `redis://${valkey.getHost()}:${String(valkey.getMappedPort(6379))}/0`;
    execFileSync('pnpm', ['--filter', '@remnaray/db', 'db:migrate:deploy'], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    const certs = mkdtempSync(join(tmpdir(), 'rr-certs-'));
    selfSigned(certs);
    const roots = new Map(
      MODES.map((mode) => [mode, mkdtempSync(join(tmpdir(), `rr-conf-${mode}-`))]),
    );

    try {
      for (const mode of MODES) {
        await renderInto(roots.get(mode), mode, 'shop.example.test', databaseUrl, valkeyUrl, false);
        const output = docker(
          [
            'run',
            '--rm',
            '--add-host',
            'web:127.0.0.1',
            '--add-host',
            'api:127.0.0.1',
            '-v',
            `${roots.get(mode)}:/etc/nginx/conf.d:ro`,
            '-v',
            `${certs}:/etc/nginx/certs:ro`,
            '-v',
            `${certs}:/etc/letsencrypt/live/shop.example.test:ro`,
            IMAGE,
            'nginx',
            '-t',
            '-c',
            '/etc/nginx/conf.d/nginx.conf',
          ],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        assert.match(output, /test is successful/u, `nginx -t failed for ${mode}`);
      }

      // --- reload within fifteen seconds of a domain change (section 21.6) ---
      const output = roots.get('acme');
      const reports = [];
      const stub = createServer((request, response) => {
        const chunks = [];
        request.on('data', (chunk) => chunks.push(chunk));
        request.on('end', () => {
          reports.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end('{"recorded":true}');
        });
      });
      await new Promise((done) => stub.listen(0, '127.0.0.1', done));
      const stubUrl = `http://127.0.0.1:${String(stub.address().port)}`;

      const watcher = await renderInto(
        output,
        'acme',
        'shop.example.test',
        databaseUrl,
        valkeyUrl,
        true,
      );
      const proxy = docker([
        'run',
        '-d',
        '--rm',
        '--add-host',
        'web:127.0.0.1',
        '--add-host',
        'api:127.0.0.1',
        '-v',
        `${output}:/etc/nginx/conf.d:ro`,
        IMAGE,
      ]).trim();

      const reloader = spawn(
        'node',
        ['apps/api/dist/tools/proxy-reloader.js', '--profile', 'nginx'],
        {
          env: {
            ...process.env,
            VALKEY_URL: valkeyUrl,
            RR_PROXY_CONTAINER: proxy,
            INTERNAL_API_URL: stubUrl,
            RR_INTERNAL_TOKEN: 'proxy-reloader-test',
          },
          stdio: 'pipe',
        },
      );
      const reloaderLog = [];
      for (const stream of [reloader.stdout, reloader.stderr])
        stream.on('data', (chunk) => reloaderLog.push(String(chunk)));

      try {
        await waitFor(() => watcher.log.join('').includes('watching rr:settings.changed'), 30_000);
        await waitFor(() => reloaderLog.join('').includes('watching rr:proxy.reload'), 30_000);

        const { createPrismaClient } = await import('../packages/db/dist/index.js');
        const prisma = createPrismaClient(databaseUrl);
        await prisma.setting.upsert({
          where: { key: 'domain.main' },
          create: { key: 'domain.main', value: 'second.example.test', isSecret: false },
          update: { value: 'second.example.test' },
        });
        await prisma.$disconnect();

        const started = Date.now();
        await valkey.exec([
          'valkey-cli',
          'publish',
          'rr:settings.changed',
          '{"keys":["domain.main"]}',
        ]);
        await waitFor(
          () =>
            readFileSync(join(output, 'site.conf'), 'utf8').includes(
              'server_name second.example.test;',
            ) && reports.length > 0,
          15_000,
        );
        const elapsed = Date.now() - started;
        assert.ok(elapsed <= 15_000, `reload took ${String(elapsed)} ms`);
        assert.deepEqual(reports.at(-1), { ok: true }, reloaderLog.join(''));
        process.stdout.write(`proxy reload after a domain change: ${String(elapsed)} ms\n`);
      } finally {
        reloader.kill('SIGTERM');
        watcher.child?.kill('SIGTERM');
        stub.close();
        docker(['rm', '-f', proxy], { expectSuccess: false });
      }
    } finally {
      rmSync(certs, { recursive: true, force: true });
      for (const directory of roots.values()) rmSync(directory, { recursive: true, force: true });
      await valkey.stop();
      await postgres.stop();
    }
  },
);

async function waitFor(condition, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (condition()) return;
    } catch {
      // not ready yet
    }
    await sleep(200);
  }
  throw new Error('Timed out waiting for the condition');
}
