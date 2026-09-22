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
if (args.includes('config') && args.includes('--services')) console.log('proxy-caddy\\nproxy-nginx\\nedge\\ncertbot\\nproxy-config\\nproxy-reloader');
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(root, 'curl'),
      `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.RR_TEST_LOG, JSON.stringify(['curl', ...process.argv.slice(2)]) + '\\n');
if (process.env.RR_TEST_CURL_FAIL) { process.stderr.write('certificate verify failed'); process.exit(60); }
process.stdout.write('ok');
`,
      { mode: 0o755 },
    );
    const result = spawnSync('sh', [rr, ...command], {
      timeout: 10000,
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
    '--no-deps',
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
    'sh /scripts/certbot.sh deploy',
  ]);
  assert.ok(!issue.includes('renew'));
  const certbot = readFileSync('deploy/proxy/certbot.sh', 'utf8');
  assert.match(certbot, /certbot renew --webroot -w \/var\/www\/certbot/);
});

test('tls:issue refuses missing issuance settings and propagates Certbot failures', () => {
  assert.equal(run(['tls:issue'], { RR_ACME_EMAIL: '' }).status, 2);
  assert.equal(run(['tls:issue'], { RR_TLS_MODE: 'custom' }).status, 1);
  const failed = run(['tls:issue'], {}, 'certonly');
  assert.equal(failed.status, 1);
  assert.ok(!failed.calls.some((args) => args.includes('restart')));
});

test('profile lifecycle removes only stale proxy containers and down enables every deployment profile', () => {
  const switched = run(['up']);
  assert.ok(
    switched.calls.some(
      (args) => args[0] === 'compose' && args.includes('*') && args.includes('config'),
    ),
  );
  assert.ok(
    switched.calls.some(
      (args) => args[0] === 'compose' && args.includes('rm') && args.includes('--stop'),
    ),
  );
  assert.ok(
    switched.calls.some((args) => args.includes('--wait') && args.includes('--wait-timeout')),
  );

  const down = run(['down']);
  const downCall = down.calls.find((args) => args[0] === 'compose' && args.at(-1) === 'down');
  assert.deepEqual(downCall.slice(downCall.indexOf('--profile')), ['--profile', '*', 'down']);
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

test('readiness fails with diagnostics when Compose health never succeeds', () => {
  const result = run(['up', '--wait-timeout', '1'], { RR_TLS_MODE: 'custom' }, '--wait');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /readiness failed/);
  assert.ok(result.calls.some((args) => args.includes('logs')));
  assert.ok(!result.calls.some((args) => args[0] === 'curl'));
});

test('HTTPS readiness checks a trusted chain and returns a bounded failure', () => {
  const result = run(['up', '--wait-timeout', '1'], { RR_TLS_MODE: 'acme' }, '', {
    RR_TEST_CURL_FAIL: 'true',
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /certificate verify failed/);
  const curls = result.calls.filter((args) => args[0] === 'curl');
  assert.ok(curls.length > 0);
  assert.ok(curls.every((args) => !args.includes('-k') && !args.includes('--insecure')));
  assert.ok(curls.every((args) => args.includes('shop.example.test:443:127.0.0.1')));
});

test('both proxy switches and external remove only the inactive services through Compose', () => {
  for (const [profile, stale, active] of [
    ['nginx', 'proxy-caddy', 'proxy-nginx'],
    ['caddy', 'proxy-nginx', 'proxy-caddy'],
    ['external', 'proxy-nginx', 'edge'],
  ]) {
    const result = run(['up'], {
      RR_PROXY_PROFILE: profile,
      RR_TLS_MODE: profile === 'external' ? 'none' : 'custom',
    });
    assert.equal(result.status, 0, result.stderr);
    const removals = result.calls.filter((args) => args.includes('rm'));
    assert.ok(removals.some((args) => args.at(-1) === stale));
    assert.ok(
      removals.every(
        (args) => args[0] === 'compose' && args.at(-1) !== active && !args.includes('-v'),
      ),
    );
    if (profile === 'external') assert.ok(removals.some((args) => args.at(-1) === 'proxy-config'));
  }
});

test('initial issuance waits for rendering before reload and restarts renewal on failure', () => {
  const result = run(['tls:issue']);
  const render = result.calls.findIndex((args) => args.includes('dist/tools/render-proxy.js'));
  const reload = result.calls.findIndex((args) => args.includes('--reload'));
  assert.ok(render > 0 && reload > render);
  const failed = run(['tls:issue'], {}, 'certonly');
  assert.equal(failed.status, 1);
  assert.ok(failed.calls.some((args) => args.includes('start') && args.at(-1) === 'certbot'));
  assert.ok(!failed.calls.some((args) => args.includes('--reload')));
  assert.ok(run(['down', '-v']).calls.some((args) => args.at(-1) === '-v'));
});
