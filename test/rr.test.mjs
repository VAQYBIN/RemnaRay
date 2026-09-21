import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import test from 'node:test';

const rr = resolve('scripts/rr');
function run(command, values = {}, failure = '') {
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
