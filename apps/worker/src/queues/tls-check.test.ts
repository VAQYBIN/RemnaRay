import { createServer, type Server } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { certificateStatus, TLS_ALERT_DAYS } from './tls-check';

let server: Server;
let port = 0;
let directory = '';

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'rr-tls-check-'));
  // A throwaway certificate with a known lifetime, so the reading is checkable.
  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    join(directory, 'key.pem'),
    '-out',
    join(directory, 'cert.pem'),
    '-days',
    '30',
    '-subj',
    '/CN=localhost',
  ]);
  server = createServer({
    key: readFileSync(join(directory, 'key.pem')),
    cert: readFileSync(join(directory, 'cert.pem')),
  });
  await new Promise<void>((done) => {
    server.listen(0, '127.0.0.1', done);
  });
  const address = server.address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterAll(() => {
  server.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('maintenance.tls-check (section 19.2)', () => {
  it('reads the expiry of a certificate it does not trust', async () => {
    const status = await certificateStatus('localhost', port);

    expect(status).toMatchObject({ host: 'localhost', reachable: true });
    expect(status.daysLeft).toBeGreaterThan(TLS_ALERT_DAYS);
    expect(status.daysLeft).toBeLessThanOrEqual(30);
    expect(new X509Certificate(readFileSync(join(directory, 'cert.pem'))).validTo).toBeTruthy();
    expect(Date.parse(status.expiresAt ?? '')).toBeGreaterThan(Date.now());
  });

  it('reports an unreachable host instead of throwing', async () => {
    const status = await certificateStatus('127.0.0.1', 1, 2000);

    expect(status).toMatchObject({ reachable: false, expiresAt: null, daysLeft: null });
    expect(status.error).toBeTruthy();
  });
});
