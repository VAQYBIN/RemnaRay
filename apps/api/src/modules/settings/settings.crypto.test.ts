import { describe, expect, it } from 'vitest';

import { decryptSetting, encryptSetting } from './settings.crypto';

const appKey = Buffer.alloc(32, 7).toString('base64');

describe('settings crypto', () => {
  it('encrypts and decrypts JSON values in the v1 envelope', () => {
    const value = { token: 'keep-this-private', enabled: true, nested: [1, 2] };
    const encrypted = encryptSetting(value, appKey);

    expect(encrypted.enc.startsWith('v1:')).toBe(true);
    expect(encrypted.enc).not.toContain('keep-this-private');
    expect(decryptSetting(encrypted, appKey)).toEqual(value);
  });

  it('rejects a tampered ciphertext and invalid application keys', () => {
    const encrypted = encryptSetting('secret', appKey);
    const parts = encrypted.enc.split(':');
    const ciphertext = parts[2];
    if (!ciphertext) throw new Error('test fixture has no ciphertext');
    parts[2] = `${ciphertext.slice(0, -1)}${ciphertext.endsWith('A') ? 'B' : 'A'}`;

    expect(() => decryptSetting({ enc: parts.join(':') }, appKey)).toThrow();
    expect(() => encryptSetting('secret', Buffer.alloc(31).toString('base64'))).toThrow(
      'RR_APP_KEY must decode to 32 bytes',
    );
  });
});
