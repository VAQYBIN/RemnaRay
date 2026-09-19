import { createHash, createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  AuthFailure,
  signJwt,
  telegramDataCheckString,
  verifyJwt,
  verifyTelegramWidget,
} from './auth.crypto';
import type { TelegramWidgetInput } from './auth.schemas';

const appKey = Buffer.alloc(32, 4).toString('base64');
const botToken = '123456:telegram-test-token';

function signedWidget(authDate: number): TelegramWidgetInput {
  const input = {
    id: '123456789',
    first_name: 'Test',
    username: 'tester',
    auth_date: authDate,
    hash: '',
  } satisfies TelegramWidgetInput;
  const secret = createHash('sha256').update(botToken).digest();
  input.hash = createHmac('sha256', secret).update(telegramDataCheckString(input)).digest('hex');
  return input;
}

describe('auth cryptography', () => {
  it('accepts a valid Telegram Login Widget signature', () => {
    expect(() => {
      verifyTelegramWidget(signedWidget(1_700_000_000), botToken, 1_700_000_100);
    }).not.toThrow();
  });

  it('separates invalid signatures from expired widget data', () => {
    const invalid = signedWidget(1_700_000_000);
    invalid.hash = invalid.hash.startsWith('0')
      ? `1${invalid.hash.slice(1)}`
      : `0${invalid.hash.slice(1)}`;
    expect(() => {
      verifyTelegramWidget(invalid, botToken, 1_700_000_100);
    }).toThrow(new AuthFailure('AUTH_INVALID_SIGNATURE'));
    expect(() => {
      verifyTelegramWidget(signedWidget(1_700_000_000), botToken, 1_700_000_301);
    }).toThrow(new AuthFailure('AUTH_EXPIRED'));
  });

  it('signs HS256 bot tokens with a one-hour expiry and rejects tampering', () => {
    const token = signJwt('user-1', appKey, 1_700_000_000);
    expect(verifyJwt(token, appKey, 1_700_000_100).sub).toBe('user-1');
    expect(() => verifyJwt(`${token}x`, appKey, 1_700_000_100)).toThrow(AuthFailure);
    expect(() => verifyJwt(token, appKey, 1_700_003_601)).toThrow(AuthFailure);
  });
});
