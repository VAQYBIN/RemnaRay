import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { Buffer } from 'node:buffer';

/**
 * Section 20.2's monitoring profile, the real Grafana image: without
 * RR_GRAFANA_PASSWORD it used to start as `admin`/`admin`. It now refuses to
 * start without a password of the owner's, and with one the administrator
 * signs in with exactly it.
 */
test('M5 Grafana starts only with the owner password', { timeout: 300_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'rr-grafana-'));
  const project = `rr-grafana-${String(process.pid)}`;
  // The monitoring file as the deployment includes it, on a network of its
  // own so a running stack's fixed subnet is not in the way.
  writeFileSync(
    join(directory, 'compose.yaml'),
    [
      'include:',
      `  - path: ${resolve('deploy/monitoring/compose.monitoring.yaml')}`,
      'networks:',
      '  rr_net: {}',
      '',
    ].join('\n'),
  );
  // The owner's shell may carry one; each call says which it means.
  const base = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key !== 'RR_GRAFANA_PASSWORD'),
  );
  const compose = (args, password) =>
    spawnSync('docker', ['compose', '-p', project, '--profile', 'monitoring', ...args], {
      cwd: directory,
      encoding: 'utf8',
      // A Grafana that does not refuse keeps running; that must fail, not hang.
      timeout: 180_000,
      env: {
        ...base,
        ...(password === undefined ? {} : { RR_GRAFANA_PASSWORD: password }),
      },
    });

  try {
    for (const password of [undefined, 'admin']) {
      const refused = compose(['run', '--rm', '--no-deps', '-T', 'grafana'], password);
      assert.equal(refused.status, 1, `${refused.stdout}${refused.stderr}`);
      assert.match(refused.stderr, /Set RR_GRAFANA_PASSWORD in \.env/u);
    }

    const secret = 'owner-grafana-secret';
    const started = compose(['up', '-d', '--no-deps', 'grafana'], secret);
    assert.equal(started.status, 0, started.stderr);
    const authorization = (user, password) =>
      `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
    const ask = (header) =>
      compose(
        [
          'exec',
          '-T',
          'grafana',
          'wget',
          '-qO-',
          '--header',
          `Authorization: ${header}`,
          'http://127.0.0.1:3010/api/user',
        ],
        secret,
      );
    let answer;
    for (let waited = 0; waited < 120_000; waited += 2_000) {
      answer = ask(authorization('admin', secret));
      if (answer.status === 0) break;
      await sleep(2_000);
    }
    assert.equal(answer?.status, 0, `${answer?.stdout ?? ''}${answer?.stderr ?? ''}`);
    assert.equal(JSON.parse(answer.stdout).login, 'admin');
    assert.notEqual(ask(authorization('admin', 'admin')).status, 0, 'admin/admin signs in');
  } finally {
    compose(['down', '-v', '--remove-orphans'], 'x');
    rmSync(directory, { recursive: true, force: true });
  }
});
