import { describe, expect, it } from 'vitest';
import { lastValueFrom, of } from 'rxjs';

import { AuditInterceptor } from './audit.interceptor';

describe('admin audit interceptor', () => {
  it('writes a sanitized audit row for every authenticated mutation', async () => {
    let auditData: Record<string, unknown> | undefined;
    const interceptor = new AuditInterceptor(
      {
        db: {
          auditLog: {
            create: ({ data }: { data: Record<string, unknown> }) => {
              auditData = data;
              return Promise.resolve(data);
            },
          },
        },
      } as never,
      { get: () => ({ action: 'users.extend', entity: 'user', idParam: 'id' }) } as never,
    );
    const request = {
      method: 'POST',
      url: '/api/admin/v1/users/user-1/extend',
      routeOptions: { url: '/api/admin/v1/users/:id/extend' },
      admin: { id: 'admin-1' },
      params: { id: 'user-1' },
      body: { reason: 'support request', password: 'do-not-store' },
      headers: { 'user-agent': 'test' },
      ip: '127.0.0.1',
    };
    const result = await lastValueFrom(
      interceptor.intercept(
        { getHandler: () => ({}), switchToHttp: () => ({ getRequest: () => request }) } as never,
        { handle: () => of({ token: 'do-not-store', ok: true }) },
      ),
    );

    expect(result).toEqual({ token: 'do-not-store', ok: true });
    expect(auditData).toMatchObject({
      actorAdminId: 'admin-1',
      action: 'users.extend',
      entity: 'user',
      entityId: 'user-1',
      reason: 'support request',
    });
    expect(auditData?.before).toEqual({ reason: 'support request', password: '***' });
    expect(auditData?.after).toEqual({ token: '***', ok: true });
  });
});
