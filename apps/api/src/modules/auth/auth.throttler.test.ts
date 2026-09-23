import { describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';

import { sessionRequestLimit, sessionTracker, skipThrottleForInternal } from './auth.module';

function context(url: string, session?: { admin?: { id: string }; user?: { id: string } }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ url, routeOptions: { url: undefined }, ip: '192.0.2.1', ...session }),
    }),
  } as unknown as ExecutionContext;
}

describe('internal throttling boundary', () => {
  it('exempts worker-to-api routes from the browser rate limit', () => {
    expect(skipThrottleForInternal(context('/api/internal/v1/payments/poll-pending'))).toBe(true);
    expect(skipThrottleForInternal(context('/api/internal/v1/system/tls-result'))).toBe(true);
    expect(skipThrottleForInternal(context('/api/v1/public/config'))).toBe(false);
  });

  it('uses the session limit and a per-account tracker after authentication', () => {
    const admin = context('/api/admin/v1/auth/me', { admin: { id: 'admin-1' } });
    const user = context('/api/v1/me', { user: { id: 'user-1' } });
    const publicRequest = context('/api/v1/public/config');
    expect(sessionRequestLimit(admin)).toBe(300);
    expect(sessionRequestLimit(user)).toBe(300);
    expect(sessionRequestLimit(publicRequest)).toBe(60);
    expect(sessionTracker(admin.switchToHttp().getRequest())).toBe('admin:admin-1');
    expect(sessionTracker(user.switchToHttp().getRequest())).toBe('user:user-1');
    expect(sessionTracker(publicRequest.switchToHttp().getRequest())).toBe('ip:192.0.2.1');
  });
});
