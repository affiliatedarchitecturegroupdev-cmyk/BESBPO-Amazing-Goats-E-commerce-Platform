import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@ag/rbac';
import {
  applyRoleChange,
  canRequestElevation,
  elevationAlert,
  isElevationActive,
  RoleChange,
  ElevationRequest,
} from './access-domain';
import { ACCESS_STORE, AccessStore } from './access.store';

export interface RequestRoleChangeInput {
  subjectId: string;
  from: Role[];
  to: Role[];
}

export interface RequestElevationInput {
  subjectId: string;
  role: Role;
  reason: string;
  minutes: number;
}

@Injectable()
export class AccessService {
  constructor(
    @Inject(ACCESS_STORE) private readonly store: AccessStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Record a role change request. It waits for a second approver. */
  async requestRoleChange(input: RequestRoleChangeInput, requestedBy: string): Promise<RoleChange> {
    const change: RoleChange = {
      id: `rc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      subjectId: input.subjectId,
      from: input.from,
      to: input.to,
      requestedBy,
      createdAt: this.now().toISOString(),
    };
    return this.store.saveRoleChange(change);
  }

  /** Approve a role change. A second, different approver is required. */
  async approveRoleChange(id: string, approverId: string): Promise<{ change: RoleChange; roles: Role[] }> {
    const change = await this.store.roleChange(id);
    if (!change) throw new NotFoundException('role change not found');
    let roles: Role[];
    try {
      roles = applyRoleChange(change, approverId);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const approved: RoleChange = { ...change, approvedBy: approverId };
    await this.store.saveRoleChange(approved);
    await this.store.setRoles(change.subjectId, roles);
    return { change: approved, roles };
  }

  /** Grant a time-limited, recorded elevation. Break-glass use alerts the board. */
  async requestElevation(input: RequestElevationInput, requestedBy: string): Promise<ElevationRequest> {
    const now = this.now();
    const req: ElevationRequest = {
      id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      subjectId: input.subjectId,
      role: input.role,
      reason: input.reason,
      requestedBy,
      minutes: input.minutes,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + input.minutes * 60_000).toISOString(),
    };
    const decision = canRequestElevation(req, now);
    if (!decision.ok) throw new BadRequestException(decision.reason);
    await this.store.saveElevation(req);
    return req;
  }

  /** Recorded elevations with their live state, newest first. */
  async listElevations(): Promise<(ElevationRequest & { active: boolean; alert: boolean })[]> {
    const now = this.now();
    const rows = await this.store.elevations();
    return rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({ ...r, active: isElevationActive(r, now), alert: elevationAlert().alert }));
  }

  async listRoleChanges(): Promise<RoleChange[]> {
    return this.store.roleChanges();
  }
}
