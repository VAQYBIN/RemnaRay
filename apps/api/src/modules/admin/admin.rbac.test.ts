import { describe, expect, it } from 'vitest';

import { RbacGuard } from './admin.rbac';

function context(role: string | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ admin: role ? { role } : undefined }) }),
  } as never;
}

describe('admin RBAC guard', () => {
  it('allows a role declared by route metadata', () => {
    const guard = new RbacGuard({
      getAllAndOverride: (key: string) => (key.includes('roles') ? ['operator'] : undefined),
    } as never);
    expect(guard.canActivate(context('operator'))).toBe(true);
    expect(guard.canActivate(context('admin'))).toBe(false);
  });

  it('checks permission metadata against the shared matrix', () => {
    const guard = new RbacGuard({
      getAllAndOverride: (key: string) =>
        key.includes('permissions') ? ['settings.write'] : undefined,
    } as never);
    expect(guard.canActivate(context('operator'))).toBe(false);
    expect(guard.canActivate(context('admin'))).toBe(true);
  });
});
