import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, request as httpRequest } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { Buffer } from 'node:buffer';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';

const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade'];

const APP_KEY = Buffer.alloc(32, 11).toString('base64');
const INTERNAL_TOKEN = 'e2e-internal-token';
const BRAND_NAME = 'Manta E2E';

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

async function waitFor(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/**
 * Minimal stand-in for the deployment's reverse proxy: `/api` and `/webhooks`
 * go to the API, everything else to `web`. The browser therefore sees one
 * origin, exactly as it does behind nginx or Caddy.
 */
function startProxy(port, apiPort, webPort) {
  const server = createServer((request, response) => {
    const toApi =
      request.url?.startsWith('/api/v1') ||
      request.url?.startsWith('/api/admin') ||
      request.url?.startsWith('/api/internal') ||
      request.url?.startsWith('/webhooks');
    const target = toApi ? apiPort : webPort;
    const upstream = httpRequest(
      {
        host: '127.0.0.1',
        port: target,
        method: request.method,
        path: request.url,
        headers: {
          ...Object.fromEntries(
            Object.entries(request.headers).filter(([key]) => !HOP_BY_HOP.includes(key)),
          ),
          host: `127.0.0.1:${String(target)}`,
        },
      },
      (upstreamResponse) => {
        // Hop-by-hop headers belong to the upstream connection, not to ours.
        const headers = Object.fromEntries(
          Object.entries(upstreamResponse.headers).filter(([key]) => !HOP_BY_HOP.includes(key)),
        );
        response.writeHead(upstreamResponse.statusCode ?? 502, headers);
        upstreamResponse.pipe(response, { end: true });
      },
    );
    upstream.on('error', () => {
      response.statusCode = 502;
      response.end('bad gateway');
    });
    request.pipe(upstream, { end: true });
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

export async function startStack() {
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
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  const seed = await seedFixtures(databaseUrl);

  const apiPort = await freePort();
  const webPort = await freePort();
  const proxyPort = await freePort();

  const apiEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(apiPort),
    DATABASE_URL: databaseUrl,
    VALKEY_URL: valkeyUrl,
    RR_APP_KEY: APP_KEY,
    RR_INTERNAL_TOKEN: INTERNAL_TOKEN,
    RR_TRUSTED_INTERNAL_CIDR: '127.0.0.0/8',
    RR_DOMAIN: `127.0.0.1:${String(proxyPort)}`,
    RR_LOG_LEVEL: 'warn',
  };
  const api = spawn('node', ['apps/api/dist/main.js'], { env: apiEnv, stdio: 'pipe' });
  const apiLog = [];
  for (const stream of [api.stdout, api.stderr])
    stream.on('data', (chunk) => {
      apiLog.push(String(chunk));
      if (process.env.RR_E2E_VERBOSE) process.stderr.write(chunk);
    });
  api.on('exit', (code) => {
    if (code !== 0 && code !== null)
      process.stderr.write(`API exited with ${String(code)}:\n${apiLog.join('')}`);
  });
  try {
    await waitFor(`http://127.0.0.1:${String(apiPort)}/api/v1/health`);
  } catch (error) {
    process.stderr.write(apiLog.join(''));
    throw error;
  }

  // Next's standalone output ships the server but not `.next/static`; the web
  // image copies it in, and so does the harness.
  const standalone = resolve(process.cwd(), 'apps/web/.next/standalone/apps/web');
  cpSync(resolve(process.cwd(), 'apps/web/.next/static'), resolve(standalone, '.next/static'), {
    recursive: true,
  });
  if (existsSync(resolve(process.cwd(), 'apps/web/public')))
    cpSync(resolve(process.cwd(), 'apps/web/public'), resolve(standalone, 'public'), {
      recursive: true,
    });

  const web = spawn('node', ['apps/web/.next/standalone/apps/web/server.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(webPort),
      HOSTNAME: '127.0.0.1',
      INTERNAL_API_URL: `http://127.0.0.1:${String(apiPort)}`,
      RR_DOMAIN: `127.0.0.1:${String(proxyPort)}`,
      RR_THEMES_DIR: `${process.cwd()}/themes`,
      RR_LOCALES_DIR: `${process.cwd()}/locales`,
    },
    stdio: 'pipe',
  });
  web.stderr.on('data', (chunk) => {
    if (process.env.RR_E2E_VERBOSE) process.stderr.write(chunk);
  });
  await waitFor(`http://127.0.0.1:${String(webPort)}/api/healthz`);

  const proxy = await startProxy(proxyPort, apiPort, webPort);
  await waitFor(`http://127.0.0.1:${String(proxyPort)}/api/v1/health`);
  const base = `http://127.0.0.1:${String(proxyPort)}`;
  for (const locale of ['ru', 'en']) await waitForFreshPage(`${base}/${locale}`);

  return {
    baseURL: `http://127.0.0.1:${String(proxyPort)}`,
    internalToken: INTERNAL_TOKEN,
    apiUrl: `http://127.0.0.1:${String(apiPort)}`,
    ...seed,
    async stop() {
      proxy.close();
      api.kill('SIGTERM');
      web.kill('SIGTERM');
      await sleep(500);
      await valkey.stop();
      await postgres.stop();
    },
  };
}

/**
 * The landing pages are prerendered at build time, when no API is reachable, so
 * the first visitor is served that build output while Next.js regenerates the
 * page in the background. Request the page until it carries the seeded brand,
 * so the specs always see the regenerated content.
 */
async function waitForFreshPage(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await globalThis.fetch(url, { headers: { 'cache-control': 'no-cache' } });
    if (response.ok && (await response.text()).includes(BRAND_NAME)) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url} to serve the seeded content`);
}

async function seedFixtures(databaseUrl) {
  const { createPrismaClient } = await import('../../packages/db/dist/index.js');
  const { hashAdminPassword, encryptTotpSecret, createTotp } =
    await import('../../apps/api/dist/modules/admin/admin.crypto.js');
  const { encryptSetting } =
    await import('../../apps/api/dist/modules/settings/settings.crypto.js');
  const prisma = createPrismaClient(databaseUrl);
  const password = 'E2ePassword123';
  const totp = createTotp('owner@example.test');

  const admin = await prisma.admin.create({
    data: {
      email: 'owner@example.test',
      passwordHash: await hashAdminPassword(password),
      role: 'admin',
      totpEnabled: true,
      totpSecretEnc: encryptTotpSecret(totp.secret.base32, APP_KEY),
    },
  });

  const plan = await prisma.plan.create({
    data: {
      slug: 'e2e-month',
      name: { ru: 'Месяц', en: 'Month' },
      description: { ru: 'Месяц доступа', en: 'A month of access' },
      durationDays: 30,
      trafficLimitBytes: 0n,
      deviceLimit: 3,
      squads: [],
      priceMinor: 29900n,
      isPublic: true,
      isActive: true,
      sortOrder: 10,
    },
  });

  await prisma.paymentProvider.create({
    data: {
      code: 'mock',
      enabled: true,
      displayName: { ru: 'Тест', en: 'Mock' },
      sortOrder: 10,
      lastHealthcheckAt: new Date(),
      lastHealthcheckOk: true,
    },
  });

  const botToken = `${String(randomBytes(4).readUInt32BE(0))}:${createHash('sha256').update('e2e').digest('hex').slice(0, 20)}`;
  await prisma.setting.createMany({
    data: [
      { key: 'brand.name', value: BRAND_NAME, isSecret: false },
      { key: 'bot.username', value: 'manta_e2e_bot', isSecret: false },
      { key: 'bot.token', value: encryptSetting(botToken, APP_KEY), isSecret: true },
      { key: 'trial.enabled', value: true, isSecret: false },
      { key: 'domain.main', value: 'example.test', isSecret: false },
    ],
    skipDuplicates: true,
  });

  const user = await prisma.user.create({
    data: {
      telegramId: 998000001n,
      username: 'e2euser',
      firstName: 'E2E',
      language: 'ru',
      referralCode: 'E2EUSER1',
    },
  });
  await prisma.account.create({
    data: { kind: 'user', userId: user.id, currency: 'RUB', balanceMinor: 50_000n },
  });

  await prisma.$disconnect();
  return {
    admin: { email: admin.email, password, totpSecret: totp.secret.base32 },
    plan: { id: plan.id, slug: plan.slug },
    user: { id: user.id, telegramId: user.telegramId.toString() },
  };
}
