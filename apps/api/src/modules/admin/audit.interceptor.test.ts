import { describe, expect, it } from 'vitest';
import { lastValueFrom, of } from 'rxjs';

import { Audited, AuditInterceptor } from './audit.interceptor';

function fixture() {
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
  const replyHeaders: Record<string, string> = {};
  const reply = { getHeader: (name: string) => replyHeaders[name] };
  const run = (response: unknown): Promise<unknown> =>
    lastValueFrom(
      interceptor.intercept(
        {
          getHandler: () => ({}),
          switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
        } as never,
        { handle: () => of(response) },
      ),
    );
  return { run, audit: () => auditData, replyHeaders };
}

describe('admin audit interceptor', () => {
  it('records the prior state supplied by the handler and answers with the body', async () => {
    const test = fixture();
    const result = await test.run(
      new Audited(
        { expiresAt: '2026-01-01T00:00:00.000Z' },
        { expiresAt: '2026-02-01T00:00:00.000Z' },
        { ok: true },
      ),
    );

    expect(result).toEqual({ ok: true });
    expect(test.audit()).toMatchObject({
      actorAdminId: 'admin-1',
      action: 'users.extend',
      entity: 'user',
      entityId: 'user-1',
      reason: 'support request',
      ip: '127.0.0.1',
    });
    expect(test.audit()?.before).toEqual({ expiresAt: '2026-01-01T00:00:00.000Z' });
    expect(test.audit()?.after).toEqual({ expiresAt: '2026-02-01T00:00:00.000Z' });
  });

  it('masks secrets and records a response-only mutation as after state', async () => {
    const test = fixture();
    const result = await test.run({ token: 'do-not-store', ok: true });

    expect(result).toEqual({ token: 'do-not-store', ok: true });
    expect(test.audit()?.before).toBeUndefined();
    expect(test.audit()?.after).toEqual({ token: '***', ok: true });
  });

  it('records nothing for a repeat answered from the Idempotency-Key store', async () => {
    const test = fixture();
    // The idempotency interceptor, inside this one, answered from the store.
    test.replyHeaders['Idempotent-Replay'] = 'true';
    const result = await test.run({ balance: { amountMinor: 1234, currency: 'RUB' } });

    expect(result).toEqual({ balance: { amountMinor: 1234, currency: 'RUB' } });
    expect(test.audit()).toBeUndefined();
  });

  it('cuts oversized states down to 16 KB', async () => {
    const test = fixture();
    await test.run(new Audited(null, { blob: 'x'.repeat(20_000) }));

    expect(test.audit()?.after).toMatchObject({ truncated: true });
  });
});
