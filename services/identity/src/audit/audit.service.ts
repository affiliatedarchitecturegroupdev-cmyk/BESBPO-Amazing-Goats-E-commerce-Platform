import { Inject, Injectable, Optional } from '@nestjs/common';
import { AUDIT_STORE, AuditFilter, AuditRecord, AuditStore, InMemoryAuditStore } from '@ag/nest-auth';

@Injectable()
export class AuditService {
  constructor(@Optional() @Inject(AUDIT_STORE) private readonly store: AuditStore = new InMemoryAuditStore()) {}

  /** The append-only audit log, newest first, optionally filtered. */
  list(filter: AuditFilter = {}): Promise<AuditRecord[]> {
    return this.store.list(filter);
  }
}
