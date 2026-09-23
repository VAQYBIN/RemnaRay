import { describe, expect, it } from 'vitest';

import { skipThrottleForInternal } from './auth.module';

function context(url: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ url, routeOptions: { url: undefined } }),
    }),
  } as never;
}

describe('internal throttling boundary', () => {
  it('exempts worker-to-api routes from the browser rate limit', () => {
    expect(skipThrottleForInternal(context('/api/internal/v1/payments/poll-pending'))).toBe(true);
    expect(skipThrottleForInternal(context('/api/internal/v1/system/tls-result'))).toBe(true);
    expect(skipThrottleForInternal(context('/api/v1/public/config'))).toBe(false);
  });
});
