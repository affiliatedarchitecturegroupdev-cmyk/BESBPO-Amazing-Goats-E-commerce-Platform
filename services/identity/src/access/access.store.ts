import { Role } from '@ag/rbac';
import { ElevationRequest, RoleChange } from './access-domain';

export const ACCESS_STORE = Symbol('ACCESS_STORE');

/** Persistence boundary for identity.access_* tables; the SQL adapter lands with the store swap. */
export interface AccessStore {
  roleChange(id: string): Promise<RoleChange | undefined>;
  roleChanges(): Promise<RoleChange[]>;
  saveRoleChange(change: RoleChange): Promise<RoleChange>;
  rolesFor(subjectId: string): Promise<Role[]>;
  setRoles(subjectId: string, roles: Role[]): Promise<void>;

  elevation(id: string): Promise<ElevationRequest | undefined>;
  saveElevation(req: ElevationRequest): Promise<ElevationRequest>;
  elevations(): Promise<ElevationRequest[]>;
}

export class InMemoryAccessStore implements AccessStore {
  private readonly changes = new Map<string, RoleChange>();
  private readonly roles = new Map<string, Role[]>();
  private readonly elevs = new Map<string, ElevationRequest>();

  async roleChange(id: string): Promise<RoleChange | undefined> {
    return this.changes.get(id);
  }

  async roleChanges(): Promise<RoleChange[]> {
    return [...this.changes.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveRoleChange(change: RoleChange): Promise<RoleChange> {
    this.changes.set(change.id, change);
    return change;
  }

  async rolesFor(subjectId: string): Promise<Role[]> {
    return this.roles.get(subjectId) ?? [];
  }

  async setRoles(subjectId: string, roles: Role[]): Promise<void> {
    this.roles.set(subjectId, roles);
  }

  async elevation(id: string): Promise<ElevationRequest | undefined> {
    return this.elevs.get(id);
  }

  async saveElevation(req: ElevationRequest): Promise<ElevationRequest> {
    this.elevs.set(req.id, req);
    return req;
  }

  async elevations(): Promise<ElevationRequest[]> {
    return [...this.elevs.values()];
  }
}
