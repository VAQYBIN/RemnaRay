import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, NEVER, of, throwError, type Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { Infrastructure } from '../infra/infra.module';
import { IdempotencyInterceptor, IdempotencyRequired } from './idempotency.interceptor';

const KEY = '0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee';

/** The three Valkey calls the store makes, with `NX` honoured. */
function valkey() {
  const keys = new Map<string, string>();
  return {
    keys,
    set: vi.fn((key: string, value: string, ...options: unknown[]) => {
      if (options.includes('NX') && keys.has(key)) return Promise.resolve(null);
      keys.set(key, value);
      return Promise.resolve('OK');
    }),
    get: vi.fn((key: string) => Promise.resolve(keys.get(key) ?? null)),
    del: vi.fn((key: string) => Promise.resolve(Number(keys.delete(key)))),
  };
}

class Handlers {
  @IdempotencyRequired()
  required() {
    return undefined;
  }

  optional() {
    return undefined;
  }
}

function setup() {
  const redis = valkey();
  const interceptor = new IdempotencyInterceptor(
    { redis, db: {} } as unknown as Infrastructure,
    new Reflector(),
  );
  const headers: Record<string, string> = {};
  const call = (
    options: {
      key?: string;
      body?: unknown;
      path?: string;
      handler?: 'required' | 'optional';
      userId?: string;
      result?: () => Observable<unknown>;
    } = {},
  ) => {
    const request = {
      method: 'POST',
      url: options.path ?? '/api/v1/me/invoices',
      headers: options.key === undefined ? {} : { 'idempotency-key': options.key },
      body: options.body ?? { kind: 'topup', provider: 'mock', amountMinor: 10000 },
      user: { id: options.userId ?? 'user-1' },
    };
    const reply = {
      header: (name: string, value: string) => {
        headers[name] = value;
        return reply;
      },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
      getHandler: () => Reflect.get(Handlers.prototype, options.handler ?? 'optional') as unknown,
    } as unknown as ExecutionContext;
    const handle = vi.fn(options.result ?? (() => of({ id: 'invoice-1', status: 'pending' })));
    const next: CallHandler = { handle };
    return { run: async () => lastValueFrom(await interceptor.intercept(context, next)), handle };
  };
  return { redis, call, headers };
}

describe('the section 9.2 Idempotency-Key store', () => {
  it('performs the first request and keeps its response for 24 h per user', async () => {
    const { redis, call } = setup();
    const first = call({ key: KEY });

    await expect(first.run()).resolves.toEqual({ id: 'invoice-1', status: 'pending' });
    expect(first.handle).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenLastCalledWith(
      `rr:idem:user-1:${KEY}`,
      expect.stringContaining('"state":"done"'),
      'EX',
      86_400,
    );
  });

  it('answers the same request again from the store with Idempotent-Replay: true', async () => {
    const { call, headers } = setup();
    await call({ key: KEY }).run();
    const again = call({ key: KEY, result: () => of({ id: 'invoice-2' }) });

    await expect(again.run()).resolves.toEqual({ id: 'invoice-1', status: 'pending' });
    expect(again.handle).not.toHaveBeenCalled();
    expect(headers['Idempotent-Replay']).toBe('true');
  });

  it('refuses the key with another request as 422 IDEMPOTENCY_KEY_REUSED', async () => {
    const { call } = setup();
    await call({ key: KEY }).run();
    const other = call({ key: KEY, body: { kind: 'topup', provider: 'mock', amountMinor: 20000 } });

    await expect(other.run()).rejects.toMatchObject({
      status: 422,
      response: { error: { code: 'IDEMPOTENCY_KEY_REUSED' } },
    });
    expect(other.handle).not.toHaveBeenCalled();
  });

  it('answers 409 while the first request with the key is still running', async () => {
    const { redis, call } = setup();
    // A first request whose handler has not answered yet.
    void call({ key: KEY, result: () => NEVER }).run();
    await vi.waitFor(() => {
      expect(redis.keys.get(`rr:idem:user-1:${KEY}`)).toContain('"state":"pending"');
    });
    const second = call({ key: KEY });
    await expect(second.run()).rejects.toMatchObject({
      status: 409,
      response: { error: { code: 'CONFLICT' } },
    });
    expect(second.handle).not.toHaveBeenCalled();
  });

  it('keeps no failed response, so a retry is performed', async () => {
    const { redis, call } = setup();
    const failing = call({ key: KEY, result: () => throwError(() => new Error('panel down')) });
    await expect(failing.run()).rejects.toThrow('panel down');
    expect(redis.keys.size).toBe(0);

    const retry = call({ key: KEY });
    await expect(retry.run()).resolves.toEqual({ id: 'invoice-1', status: 'pending' });
    expect(retry.handle).toHaveBeenCalledTimes(1);
  });

  it('keeps the keys of different users apart (section 9.2 rr:idem:<userId>:<key>)', async () => {
    const { redis, call } = setup();
    await call({ key: KEY }).run();
    const another = call({ key: KEY, userId: 'user-2', result: () => of({ id: 'invoice-9' }) });

    // Another user's same key is a request of their own, performed for them.
    await expect(another.run()).resolves.toEqual({ id: 'invoice-9' });
    expect(another.handle).toHaveBeenCalledTimes(1);
    expect([...redis.keys.keys()].sort()).toEqual([
      `rr:idem:user-1:${KEY}`,
      `rr:idem:user-2:${KEY}`,
    ]);
  });

  it('requires the key where section 9.4 does, and a UUID wherever one is sent', async () => {
    const { call } = setup();
    await expect(call({ handler: 'required' }).run()).rejects.toMatchObject({
      status: 400,
      response: { error: { code: 'VALIDATION_ERROR' } },
    });
    await expect(call({ key: 'not-a-uuid' }).run()).rejects.toMatchObject({ status: 400 });
    // Optional elsewhere: no key, no store, performed as is.
    const plain = call();
    await expect(plain.run()).resolves.toEqual({ id: 'invoice-1', status: 'pending' });
  });
});
