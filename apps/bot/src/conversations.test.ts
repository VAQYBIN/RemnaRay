import { describe, expect, it } from 'vitest';

import { conversationTtlSeconds, parseAmount } from './conversations.js';

describe('bot conversations', () => {
  it('parses decimal RUB amounts into minor units', () => {
    expect(parseAmount('500')).toBe('50000');
    expect(parseAmount('12.3')).toBe('1230');
    expect(parseAmount('12,34')).toBe('1234');
    expect(parseAmount('0.001')).toBeUndefined();
  });

  it('uses the ten-minute conversation TTL required by the specification', () => {
    expect(conversationTtlSeconds).toBe(600);
  });
});
