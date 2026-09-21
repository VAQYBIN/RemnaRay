import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import test from 'node:test';

const rr = resolve('scripts/rr');
function run(command, values = {}, failure = '', options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rr-cli-'));
  try {
    writeFileSync(
      join(root, '.env'),
      Object.entries({
        RR_PROXY_PROFILE: 'nginx',
        RR_TLS_MODE: 'certbot',
        RR_DOMAIN: 'shop.example.test',
        RR_ACME_EMAIL: 'owner@example.test',
        ...values,
      })
        .map(([key, value]) => `${key}=${value}`)
        .join('\n'),
    );
    writeFileSync(
      join(root, 'docker'),
      `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.RR_TEST_LOG, JSON.stringify(args) + '\\n');
if (process.env.RR_TEST_FAILURE && args.includes(process.env.RR_TEST_FAILURE)) process.exit(1);
if (args[0] === 'ps' && process.env.RR_TEST_STALE_ID) console.log(process.env.RR_TEST_STALE_ID);
`,
      { mode: 0o755 },
    );
    const result = spawnSync('sh', [rr, ...command], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        RR_TEST_LOG: join(root, 'calls'),
        RR_TEST_FAILURE: failure,
        ...options,
      },
    });
    let calls = [];
    try {
      calls = readFileSync(join(root, 'calls'), 'utf8').trim().split('\n').map(JSON.parse);
    } catch {
      // Validation can fail before Docker is invoked.
    }
    return { ...result, calls };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('tls:issue overrides the renewal entrypoint with initial certonly issuance', () => {
  const result = run(['tls:issue']);
  assert.equal(result.status, 0, result.stderr);
  const issue = result.calls.find((args) => args.includes('certonly'));
  assert.deepEqual(issue.slice(issue.indexOf('run')), [
    'run',
    '--rm',
    '--entrypoint',
    'certbot',
    'certbot',
    'certonly',
    '--webroot',
    '-w',
    '/var/www/certbot',
    '-d',
    'shop.example.test',
    '-m',
    'owner@example.test',
    '--agree-tos',
    '-n',
    '--cert-name',
    'shop.example.test',
    '--keep-until-expiring',
    '--deploy-hook',
    'touch /run/remnaray/certbot/.issued',
  ]);
  assert.ok(!issue.includes('renew'));
  const compose = readFileSync('compose.yaml', 'utf8');
  assert.match(compose, /certbot renew --webroot -w \/var\/www\/certbot/);
});

test('tls:issue refuses missing issuance settings and propagates Certbot failures', () => {
  assert.equal(run(['tls:issue'], { RR_ACME_EMAIL: '' }).status, 2);
  assert.equal(run(['tls:issue'], { RR_TLS_MODE: 'custom' }).status, 1);
  const failed = run(['tls:issue'], {}, 'certonly');
  assert.equal(failed.status, 1);
  assert.ok(!failed.calls.some((args) => args.includes('restart')));
});

test('profile lifecycle removes only stale proxy containers and down enables every deployment profile', () => {
  const switched = run(['up'], {}, '', { RR_TEST_STALE_ID: 'old-nginx' });
  assert.ok(switched.calls.some((args) => args[0] === 'rm' && args.includes('old-nginx')));
  assert.ok(
    switched.calls.some((args) => args.includes('--wait') && args.includes('--wait-timeout')),
  );

  const down = run(['down']);
  const downCall = down.calls.find((args) => args[0] === 'compose' && args.at(-1) === 'down');
  assert.deepEqual(downCall.slice(downCall.indexOf('--profile')), [
    '--profile',
    'nginx',
    '--profile',
    'caddy',
    '--profile',
    'external',
    '--profile',
    'certbot',
    'down',
  ]);
});

test('proxy-config and proxy-reloader do not mount Certbot private-key material', () => {
  const compose = readFileSync('compose.yaml', 'utf8');
  const proxyConfig = compose.slice(
    compose.indexOf('  proxy-config:'),
    compose.indexOf('  proxy-nginx:'),
  );
  const reloader = compose.slice(
    compose.indexOf('  proxy-reloader:'),
    compose.indexOf('  backup:'),
  );
  assert.doesNotMatch(proxyConfig, /certbot-certs/u);
  assert.doesNotMatch(reloader, /certbot-certs/u);
  assert.match(proxyConfig, /certbot-state:\/run\/remnaray\/certbot:ro/u);
  assert.match(compose, /certbot-state:\/run\/remnaray\/certbot/u);
});
