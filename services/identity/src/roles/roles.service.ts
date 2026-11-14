import { Injectable } from '@nestjs/common';
import { MATRIX, PERMISSIONS, Permission, Role } from '@ag/rbac';

export interface RoleSummary {
  role: Role;
  permissions: Permission[];
}

@Injectable()
export class RolesService {
  /** The role → permission matrix from `packages/rbac`, the source of truth. */
  list(): RoleSummary[] {
    return (Object.keys(MATRIX) as Role[]).map((role) => ({ role, permissions: MATRIX[role] }));
  }

  /** Every permission the platform knows about, in declaration order. */
  permissions(): Permission[] {
    return [...PERMISSIONS];
  }
}
