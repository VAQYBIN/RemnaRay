import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageManifest = JSON.parse(await readFile('package.json', 'utf8'));
const workspaceManifest = await readFile('pnpm-workspace.yaml', 'utf8');

test('the root pins the supported package manager and runtime', () => {
  assert.equal(packageManifest.packageManager, 'pnpm@11.26.0');
  assert.equal(packageManifest.engines.node, '>=24.21 <25');
});

test('the workspace includes application and package shells', () => {
  assert.match(workspaceManifest, /- apps\/\*/);
  assert.match(workspaceManifest, /- packages\/\*/);
});

test('the required repository tooling is configured', () => {
  assert.equal(packageManifest.scripts.lint, 'eslint .');
  assert.equal(packageManifest.scripts.typecheck, 'tsc --noEmit');
  assert.equal(packageManifest.scripts.prepare, 'husky');
  assert.ok(packageManifest.devDependencies['@changesets/cli']);
  assert.ok(packageManifest.devDependencies['@commitlint/cli']);
  assert.ok(packageManifest.devDependencies.husky);
  assert.ok(packageManifest.devDependencies['lint-staged']);
});

const packageManifests = {
  root: packageManifest,
  api: JSON.parse(await readFile('apps/api/package.json', 'utf8')),
  bot: JSON.parse(await readFile('apps/bot/package.json', 'utf8')),
  worker: JSON.parse(await readFile('apps/worker/package.json', 'utf8')),
  web: JSON.parse(await readFile('apps/web/package.json', 'utf8')),
  config: JSON.parse(await readFile('packages/config/package.json', 'utf8')),
  db: JSON.parse(await readFile('packages/db/package.json', 'utf8')),
  domain: JSON.parse(await readFile('packages/domain/package.json', 'utf8')),
  i18n: JSON.parse(await readFile('packages/i18n-core/package.json', 'utf8')),
  logger: JSON.parse(await readFile('packages/logger/package.json', 'utf8')),
  sdk: JSON.parse(await readFile('packages/remnawave-sdk/package.json', 'utf8')),
  theme: JSON.parse(await readFile('packages/theme-schema/package.json', 'utf8')),
  ui: JSON.parse(await readFile('packages/ui/package.json', 'utf8')),
  testFixtures: JSON.parse(await readFile('packages/test-fixtures/package.json', 'utf8')),
};

function dependencyVersion(manifest, name) {
  return (
    manifest.dependencies?.[name] ??
    manifest.devDependencies?.[name] ??
    manifest.peerDependencies?.[name]
  );
}

test('the section 6.1 JavaScript dependency matrix is pinned', () => {
  const expected = {
    '@types/node': ['root', '~24.13.6'],
    turbo: ['root', '~2.11.0'],
    typescript: ['root', '~7.0.2'],
    eslint: ['root', '~10.10.0'],
    prettier: ['root', '~3.9.8'],
    '@nestjs/cli': ['root', '12.0.3'],
    '@nestjs/testing': ['root', '12.0.3'],
    '@playwright/test': ['root', '~1.63.0'],
    testcontainers: ['root', '~12.1.0'],
    tsx: ['root', '~4.23.13'],
    vitest: ['root', '~5.0.1'],
    '@changesets/cli': ['root', '~3.0.3'],
    husky: ['root', '~9.1.7'],
    'lint-staged': ['root', '~17.5.1'],
    '@commitlint/cli': ['root', '~21.2.2'],
    '@commitlint/config-conventional': ['root', '~21.2.2'],
    '@nestjs/common': ['api', '12.0.3'],
    '@nestjs/core': ['api', '12.0.3'],
    '@nestjs/platform-fastify': ['api', '12.0.3'],
    '@nestjs/config': ['api', '12.0.0'],
    '@nestjs/swagger': ['api', '12.0.1'],
    '@nestjs/terminus': ['api', '12.0.0'],
    '@nestjs/throttler': ['api', '~6.7.0'],
    '@fastify/helmet': ['api', '~13.1.1'],
    fastify: ['api', '~5.12.5'],
    '@asteasolutions/zod-to-openapi': ['api', '~9.1.0'],
    '@scalar/nestjs-api-reference': ['api', '~1.2.19'],
    pino: ['api', '~10.3.1'],
    'nestjs-pino': ['api', '~5.2.0'],
    'pino-http': ['api', '~11.0.0'],
    undici: ['api', '~8.10.2'],
    dayjs: ['api', '~1.11.23'],
    'intl-messageformat': ['api', '~12.1.1'],
    zod: ['domain', '~4.6.5'],
    '@node-rs/argon2': ['api', '~2.2.1'],
    otpauth: ['api', '~9.5.2'],
    sharp: ['api', '~0.35.4'],
    grammy: ['bot', '~1.46.0'],
    '@grammyjs/conversations': ['bot', '~2.1.1'],
    '@grammyjs/menu': ['bot', '~1.5.0'],
    '@grammyjs/runner': ['bot', '~2.0.3'],
    '@grammyjs/auto-retry': ['bot', '~2.0.2'],
    '@grammyjs/ratelimiter': ['bot', '~1.2.1'],
    '@grammyjs/storage-redis': ['bot', '~2.6.0'],
    ioredis: ['bot', '~5.11.1'],
    '@nestjs/bullmq': ['worker', '12.0.0'],
    '@nestjs/schedule': ['worker', '12.0.2'],
    bullmq: ['worker', '~6.3.7'],
    prisma: ['db', '7.10.0'],
    '@prisma/client': ['db', '7.10.0'],
    '@prisma/adapter-pg': ['db', '7.10.0'],
    '@testcontainers/postgresql': ['testFixtures', '~12.1.0'],
    next: ['web', '~16.3.5'],
    'next-intl': ['web', '~4.14.5'],
    react: ['web', '~19.3.0'],
    'react-dom': ['web', '~19.3.0'],
    tailwindcss: ['web', '~4.3.3'],
    '@radix-ui/react-dialog': ['web', '~1.1.23'],
    'class-variance-authority': ['web', '~0.7.1'],
    'tailwind-merge': ['web', '~3.7.0'],
    'lucide-react': ['web', '~1.47.0'],
  };
  for (const [name, [manifest, version]] of Object.entries(expected)) {
    assert.equal(
      dependencyVersion(packageManifests[manifest], name),
      version,
      `${manifest}: ${name}`,
    );
  }
});

test('pnpm policy and Renovate exceptions are explicit', async () => {
  const npmrc = await readFile('.npmrc', 'utf8');
  const renovate = JSON.parse(await readFile('renovate.json', 'utf8'));
  assert.match(npmrc, /^engine-strict=true$/m);
  assert.match(npmrc, /^save-exact=false$/m);
  assert.match(npmrc, /^save-prefix=~$/m);
  assert.equal(packageManifest.packageManager, 'pnpm@11.26.0');
  assert.deepEqual(renovate.ignoreDeps, [
    'pnpm',
    'prisma',
    '@prisma/client',
    '@prisma/adapter-pg',
    'grammy',
    'ioredis',
  ]);
  assert.equal(renovate.minimumReleaseAge, '7 days');
  assert.equal(renovate.vulnerabilityAlerts.minimumReleaseAge, null);
});

test('the Caddy proxy image pins the verified release and rate-limit module', async () => {
  const dockerfile = await readFile('deploy/proxy/caddy/Dockerfile', 'utf8');
  assert.match(dockerfile, /^ARG CADDY_VERSION=2\.11\.4$/m);
  assert.match(dockerfile, /FROM caddy:\$\{CADDY_VERSION\}-builder-alpine AS builder/);
  assert.match(dockerfile, /xcaddy build --with github\.com\/mholt\/caddy-ratelimit/);
  assert.match(dockerfile, /http\.handlers\.rate_limit/);
});

test('the Remnawave contract verification is recorded', async () => {
  const adr = await readFile('docs/adr/ADR-010.md', 'utf8');
  assert.match(adr, /Remnawave API v3\.4\.4/);
  assert.match(adr, /bebc345543b82c66ee1f956333e65cddfb8aec46099bf4427de38fb43df69396/);
  for (const method of [
    'system.stats',
    'users.create',
    'users.update',
    'users.getByTelegramId',
    'squads.list',
    'hwid.remove',
  ]) {
    const row = adr.split('\n').find((line) => line.includes(`\`${method}\``));
    assert.ok(row?.includes('✓') || row?.includes('✗'), method);
  }
});

test('the four process shells expose their required health entrypoints', async () => {
  const api = await readFile('apps/api/src/health/health.controller.ts', 'utf8');
  const bot = await readFile('apps/bot/src/main.ts', 'utf8');
  const worker = await readFile('apps/worker/src/health/health.controller.ts', 'utf8');
  const web = await readFile('apps/web/app/api/healthz/route.ts', 'utf8');

  assert.match(api, /@Controller\('api\/v1\/health'\)/);
  assert.match(api, /@Get\('ready'\)/);
  assert.match(bot, /createServer/);
  assert.match(bot, /service: 'bot'/);
  assert.match(worker, /@Controller\('health'\)/);
  assert.match(worker, /service: 'worker'/);
  assert.match(web, /dynamic = 'force-dynamic'/);
  assert.match(web, /service: 'web'/);
});
