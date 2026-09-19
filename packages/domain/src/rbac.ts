export const adminRoles = ['admin', 'operator'] as const;
export type AdminRole = (typeof adminRoles)[number];

export const permissions = [
  'dashboard.read',
  'users.read',
  'users.mutate',
  'users.balance.credit',
  'users.balance.debit',
  'users.anonymize',
  'subscriptions.read',
  'subscriptions.bulk',
  'payments.read',
  'payments.recheck',
  'payments.refund',
  'plans.read',
  'plans.write',
  'promocodes.read',
  'promocodes.write',
  'referrals.read',
  'referrals.write',
  'broadcasts.read',
  'broadcasts.write',
  'settings.read',
  'settings.write',
  'providers.write',
  'panel.write',
  'bot.write',
  'themes.write',
  'i18n.read',
  'i18n.write',
  'admins.write',
  'audit.read',
  'system.read',
  'system.write',
] as const;
export type Permission = (typeof permissions)[number];

const operatorPermissions: ReadonlySet<Permission> = new Set([
  'dashboard.read',
  'users.read',
  'users.mutate',
  'users.balance.credit',
  'subscriptions.read',
  'payments.read',
  'payments.recheck',
  'payments.refund',
  'plans.read',
  'promocodes.read',
  'promocodes.write',
  'referrals.read',
  'broadcasts.read',
  'broadcasts.write',
  'i18n.read',
  'system.read',
]);

export function permissionsFor(role: AdminRole): Permission[] {
  return role === 'admin' ? [...permissions] : [...operatorPermissions];
}

export function can(role: AdminRole, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export function isAdminRole(value: string): value is AdminRole {
  return adminRoles.includes(value as AdminRole);
}

export function adminMe(admin: {
  id: string;
  email: string;
  role: AdminRole;
  telegramId: bigint | null;
}) {
  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    telegramId: admin.telegramId?.toString() ?? null,
    permissions: permissionsFor(admin.role),
  };
}
