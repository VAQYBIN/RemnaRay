import { describe, expect, it } from 'vitest';

import { incidentId, outgoingThrottle } from './bot.js';

describe('bot error and delivery boundaries', () => {
  it('creates an eight-character incident id without punctuation', () => {
    expect(incidentId()).toMatch(/^[A-Za-z0-9_-]{8}$/u);
  });

  it('serializes message delivery through the global transformer', async () => {
    const calls: number[] = [];
    const transformer = outgoingThrottle();
    const prev = () => {
      calls.push(Date.now());
      return Promise.resolve(true as never);
    };
    await Promise.all([
      transformer(prev, 'sendMessage', { chat_id: 1, text: 'one' }),
      transformer(prev, 'sendMessage', { chat_id: 2, text: 'two' }),
    ]);
    expect(calls).toHaveLength(2);
    const first = calls[0];
    const second = calls[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(second && first ? second - first : 0).toBeGreaterThanOrEqual(30);
  });
});
