import { MATRIX, Permission, Role } from '@ag/rbac';

/** A capability column in the roles matrix, e.g. Orders or Pricing. */
export interface Capability {
  key: string;
  label: string;
  read: Permission;
  write?: Permission;
  approve?: Permission;
}

/** The columns the wireframe `ad-roles` shows. */
export const CAPABILITIES: Capability[] = [
  { key: 'orders', label: 'Orders', read: 'orders:read', write: 'orders:write' },
  { key: 'pricing', label: 'Pricing', read: 'pricing:read', write: 'pricing:write', approve: 'pricing:approve' },
  { key: 'credit', label: 'Credit', read: 'credit:read', write: 'credit:write', approve: 'credit:approve' },
  { key: 'pii', label: 'PII', read: 'pii:read' },
  { key: 'roles', label: 'Roles', read: 'roles:manage', write: 'roles:manage' },
];

/**
 * The cell code for a role in a capability column:
 * `W+A` write and approve, `W` write, `A` approve only, `R` read only, else empty.
 */
export function cellFor(role: Role, cap: Capability): string {
  const has = (p?: Permission) => (p ? MATRIX[role]?.includes(p) ?? false : false);
  const write = has(cap.write);
  const approve = has(cap.approve);
  if (write && approve) return 'W+A';
  if (write) return 'W';
  if (approve) return 'A';
  if (has(cap.read)) return 'R';
  return '';
}

/** The whole matrix the screen renders, straight from `@ag/rbac`. */
export function roleMatrix(roles: Role[]): { role: Role; label: string; cells: string[] }[] {
  return roles.map((role) => ({
    role,
    label: roleLabel(role),
    cells: CAPABILITIES.map((cap) => cellFor(role, cap)),
  }));
}

/** `chief_admin` -> `Chief admin`. */
export function roleLabel(role: Role): string {
  const words = role.split('_');
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

/** Roles whose changes must go through a second approver (they hold roles:manage). */
export function needsSecondApprover(role: Role): boolean {
  return (MATRIX[role] ?? []).includes('roles:manage');
}
