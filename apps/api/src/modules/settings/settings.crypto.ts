import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const NONCE_BYTES = 12;
const KEY_BYTES = 32;

function decodeKey(appKey: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(appKey)) {
    throw new Error('RR_APP_KEY must be base64 encoded');
  }

  const key = Buffer.from(appKey, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error('RR_APP_KEY must decode to 32 bytes');
  }
  return key;
}

export type EncryptedSetting = { enc: string };

export function encryptSetting(value: unknown, appKey: string): EncryptedSetting {
  const key = decodeKey(appKey);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    enc: [
      VERSION,
      nonce.toString('base64'),
      ciphertext.toString('base64'),
      tag.toString('base64'),
    ].join(':'),
  };
}

export function decryptSetting(value: unknown, appKey: string): unknown {
  if (!value || typeof value !== 'object' || !('enc' in value) || typeof value.enc !== 'string') {
    throw new Error('Encrypted setting has an invalid envelope');
  }

  const [version, nonceValue, ciphertextValue, tagValue] = value.enc.split(':');
  if (version !== VERSION || !nonceValue || !ciphertextValue || !tagValue) {
    throw new Error('Encrypted setting has an invalid version or payload');
  }

  const nonce = Buffer.from(nonceValue, 'base64');
  const ciphertext = Buffer.from(ciphertextValue, 'base64');
  const tag = Buffer.from(tagValue, 'base64');
  if (nonce.length !== NONCE_BYTES || tag.length !== 16) {
    throw new Error('Encrypted setting has invalid nonce or tag length');
  }

  const decipher = createDecipheriv('aes-256-gcm', decodeKey(appKey), nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as unknown;
}
