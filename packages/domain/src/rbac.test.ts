import { describe, expect, it } from 'vitest';

import { can, permissionsFor } from './rbac.js';

describe('admin RBAC matrix', () => {
  it('gives operators only the operational permissions', () => {
    expect(can('operator', 'users.mutate')).toBe(true);
    expect(can('operator', 'users.balance.debit')).toBe(false);
    expect(can('operator', 'settings.write')).toBe(false);
    expect(permissionsFor('operator')).not.toContain('admins.write');
  });

  it('gives admins the complete permission set', () => {
    expect(can('admin', 'admins.write')).toBe(true);
    expect(can('admin', 'settings.write')).toBe(true);
    expect(permissionsFor('admin')).toContain('system.write');
  });
});
