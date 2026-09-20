import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';

import { SetupGuard } from './setup.guard';

function context(url: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ routeOptions: { url }, url }) }),
  } as never;
}

function guard(completed: boolean) {
  return new SetupGuard({ get: () => Promise.resolve(completed) } as never);
}

async function status(completed: boolean, url: string): Promise<number | boolean> {
  try {
    return await guard(completed).canActivate(context(url));
  } catch (error) {
    return error instanceof HttpException ? error.getStatus() : 0;
  }
}

async function code(completed: boolean, url: string): Promise<string> {
  try {
    await guard(completed).canActivate(context(url));
    return 'OK';
  } catch (error) {
    const body = error instanceof HttpException ? error.getResponse() : {};
    return (body as { error?: { code?: string } }).error?.code ?? 'NONE';
  }
}

describe('SetupGuard (section 17.4)', () => {
  it('answers SETUP_NOT_COMPLETED for everything but the wizard and health', async () => {
    expect(await code(false, '/api/v1/public/plans')).toBe('SETUP_NOT_COMPLETED');
    expect(await status(false, '/api/v1/public/plans')).toBe(503);
    expect(await code(false, '/api/admin/v1/users')).toBe('SETUP_NOT_COMPLETED');
    expect(await code(false, '/webhooks/mock')).toBe('SETUP_NOT_COMPLETED');
    expect(await status(false, '/api/setup/v1/state')).toBe(true);
    expect(await status(false, '/api/v1/health')).toBe(true);
    expect(await status(false, '/api/v1/health/ready')).toBe(true);
  });

  it('answers SETUP_ALREADY_COMPLETED on the wizard once it is finished', async () => {
    expect(await code(true, '/api/setup/v1/state')).toBe('SETUP_ALREADY_COMPLETED');
    expect(await status(true, '/api/setup/v1/steps/1')).toBe(404);
    expect(await status(true, '/api/v1/public/plans')).toBe(true);
    expect(await status(true, '/api/admin/v1/users')).toBe(true);
  });
});
