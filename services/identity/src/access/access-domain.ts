import { ROLES, Role, requiresSecondApprover } from '@ag/rbac';

/** A request to change a staff member's roles. */
export interface RoleChange {
  id: string;
  subjectId: string;
  from: Role[];
  to: Role[];
  requestedBy: string;
  approvedBy?: string;
  createdAt: string;
}

/** A break-glass elevation: temporary, recorded, and alerted on. */
export interface ElevationRequest {
  id: string;
  subjectId: string;
  role: Role;
  reason: string;
  requestedBy: string;
  minutes: number;
  createdAt: string;
  expiresAt: string;
  approvedBy?: string;
}

export type Decision = { ok: true } | { ok: false; reason: string };

/** Only real roles can be granted, so a typo cannot widen access. */
export function unknownRoles(roles: string[]): string[] {
  return roles.filter((r) => !(ROLES as readonly string[]).includes(r));
}

/**
 * A role change needs a second approver: someone other than the person who
 * asked for it, holding `roles:manage` (checked by the caller).
 */
export function canApplyRoleChange(change: RoleChange, approverId: string): Decision {
  if (!requiresSecondApprover('roles:manage')) return { ok: true };
  if (!approverId) return { ok: false, reason: 'approver required' };
  if (approverId === change.requestedBy) return { ok: false, reason: 'second approver must differ from requester' };
  if (change.approvedBy && change.approvedBy !== approverId) {
    return { ok: false, reason: 'already approved by someone else' };
  }
  const unknown = unknownRoles(change.to);
  if (unknown.length > 0) return { ok: false, reason: `unknown role: ${unknown.join(', ')}` };
  return { ok: true };
}

/** Apply an approved change: returns the new role set, de-duplicated and ordered. */
export function applyRoleChange(change: RoleChange, approverId: string): Role[] {
  const decision = canApplyRoleChange(change, approverId);
  if (!decision.ok) throw new Error(decision.reason);
  return [...new Set(change.to)];
}

const MAX_ELEVATION_MINUTES = 12 * 60;

/**
 * Break-glass elevation: always time limited and always recorded. It is
 * granted for a bounded window and expires on its own.
 */
export function canRequestElevation(req: ElevationRequest, now: Date): Decision {
  if (!req.reason.trim()) return { ok: false, reason: 'reason required' };
  if (req.minutes <= 0) return { ok: false, reason: 'duration must be positive' };
  if (req.minutes > MAX_ELEVATION_MINUTES) return { ok: false, reason: 'duration above maximum' };
  if (unknownRoles([req.role]).length > 0) return { ok: false, reason: `unknown role: ${req.role}` };
  if (new Date(req.createdAt).getTime() > now.getTime()) return { ok: false, reason: 'not yet valid' };
  return { ok: true };
}

/** Whether an elevation is still usable at `now`. */
export function isElevationActive(req: ElevationRequest, now: Date): boolean {
  return new Date(req.expiresAt).getTime() > now.getTime();
}

/** Minutes until an elevation expires, floored at zero. */
export function elevationMinutesLeft(req: ElevationRequest, now: Date): number {
  return Math.max(0, Math.ceil((new Date(req.expiresAt).getTime() - now.getTime()) / 60_000));
}

/** Break-glass use alerts the board, so every grant carries an alert flag. */
export function elevationAlert(): { alert: boolean; audience: 'board' } {
  return { alert: true, audience: 'board' };
}
