import { AuditRecord, assertAppendOnly } from './audit-domain';

/** Persistence boundary for `audit.audit_log`. */
export interface AuditStore {
  append(record: AuditRecord): Promise<void>;
  list(filter?: AuditFilter): Promise<AuditRecord[]>;
}

export interface AuditFilter {
  entity?: string;
  actorUserId?: string;
  limit?: number;
}

export const AUDIT_STORE = 'AG_AUDIT_STORE';

export class InMemoryAuditStore implements AuditStore {
  private readonly rows: AuditRecord[] = [];

  async append(record: AuditRecord): Promise<void> {
    this.rows.push({ ...record });
  }

  async list(filter: AuditFilter = {}): Promise<AuditRecord[]> {
    const matches = this.rows
      .filter((r) => (filter.entity ? r.entity === filter.entity : true))
      .filter((r) => (filter.actorUserId ? r.actorUserId === filter.actorUserId : true))
      .slice()
      .reverse();
    return typeof filter.limit === 'number' ? matches.slice(0, filter.limit) : matches;
  }

  // The log is append-only, so these deliberately refuse. Present so a caller
  // that reaches for them fails loudly rather than silently mutating history.
  async update(): Promise<never> {
    return assertAppendOnly('update');
  }

  async remove(): Promise<never> {
    return assertAppendOnly('delete');
  }
}
