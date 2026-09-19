import { describe, expect, it } from 'vitest';

import config from '../next.config';

describe('the site configuration serves versioned theme assets', () => {
  it('allows a local image under /themes with the section 18.2 version query', () => {
    const patterns = config.images?.localPatterns ?? [];
    const themes = patterns.find((pattern) => pattern.pathname === '/themes/**');
    expect(themes).toBeDefined();
    // Omitting `search` is what allows `?v=<version>`; an empty string blocks it.
    expect(themes?.search).toBeUndefined();
  });
});
