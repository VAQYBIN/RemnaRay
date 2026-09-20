import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { can, type AdminRole, type Permission } from '@remnaray/domain/rbac';

import type { AuthenticatedRequest } from '../auth/auth.guards';

export const ROLES_KEY = 'remnaray:admin-roles';
export const PERMISSIONS_KEY = 'remnaray:admin-permissions';
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const roleRequirements = Array.isArray(roles) ? roles : [];
    const permissionRequirements = Array.isArray(requiredPermissions) ? requiredPermissions : [];
    if (roleRequirements.length === 0 && permissionRequirements.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.admin?.role as AdminRole | undefined;
    if (!role) return false;
    if (roleRequirements.length > 0 && !roleRequirements.includes(role)) return false;
    return permissionRequirements.every((permission) => can(role, permission));
  }
}

export function requestAdmin(request: FastifyRequest & { admin?: { id: string; role: string } }) {
  return request.admin;
}
