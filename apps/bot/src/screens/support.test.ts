import { describe, expect, it, vi } from 'vitest';

import { showSupport } from './index.js';
import type { RrContext } from '../types.js';

function screen(supportForwardChatId: number | null, supportContact = '@manta_help') {
  const params: Record<string, unknown>[] = [];
  const enter = vi.fn();
  const ctx = {
    from: { id: 123 },
    session: {},
    conversation: { enter },
    t: (key: string, values: Record<string, unknown> = {}) => {
      params.push({ key, ...values });
      return key;
    },
    reply: () => ({ message_id: 1 }),
  } as unknown as RrContext;
  const api = { getConfig: () => ({ supportForwardChatId, supportContact }) } as never;
  return { ctx, api, params, enter };
}

describe('bot support screen (FR-124)', () => {
  it('shows the support contact when no operators chat is configured', async () => {
    const { ctx, api, params, enter } = screen(null);
    await showSupport(ctx, api);
    expect(enter).not.toHaveBeenCalled();
    expect(params).toContainEqual({ key: 'bot.screen.support.details', contact: '@manta_help' });
  });

  it('opens the message dialog when the operators chat is configured', async () => {
    const { ctx, api, enter } = screen(-100500);
    await showSupport(ctx, api);
    expect(enter).toHaveBeenCalledWith('supportMessage');
  });
});
