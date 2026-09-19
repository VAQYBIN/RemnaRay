import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createLogger, REDACT_PATHS } from './index.js';

describe('logger redaction', () => {
  it('covers every secret category required by section 19.6', () => {
    for (const path of [
      'authorization',
      'cookie',
      'set-cookie',
      'hash',
      'initData',
      'token',
      'secret',
      'password',
      'totpCode',
      'secret_path',
      'idempotency-key',
      'email',
    ]) {
      expect(REDACT_PATHS.some((candidate) => candidate.endsWith(path))).toBe(true);
    }
  });

  it('redacts secrets and masks email values in emitted JSON', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const logger = createLogger({ destination: stream });

    logger.info(
      {
        authorization: 'Bearer secret',
        email: 'alice@example.com',
        body: { password: 'p', token: 't' },
        safe: 'visible',
      },
      'test',
    );

    const record = JSON.parse(lines[0] as string) as Record<string, unknown>;
    expect(record.authorization).toBe('[Redacted]');
    expect(record.email).toBe('a***@example.com');
    expect(record.safe).toBe('visible');
    expect(record.body).toEqual({ password: '[Redacted]', token: '[Redacted]' });
  });
});
