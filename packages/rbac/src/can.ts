import { MATRIX } from './matrix';
import { Permission } from './permissions';
import { Role } from './roles';

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}
export function canAny(roles: Role[], permission: Permission): boolean {
  return roles.some((r) => can(r, permission));
}
/** Actions that always need a second approver (four-eyes). */
export const TWO_PERSON: Permission[] = [
  'pricing:approve','credit:approve','refunds:approve','payouts:approve','roles:manage','data:export','system:break_glass',
];
export function requiresSecondApprover(permission: Permission): boolean {
  return TWO_PERSON.includes(permission);
}
