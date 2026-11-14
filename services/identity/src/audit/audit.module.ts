import { Module } from '@nestjs/common';
import { AUDIT_STORE, InMemoryAuditStore } from '@ag/nest-auth';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * Owns the append-only audit log and exports it, so the request interceptor
 * registered in AppModule writes to the same log this module reads.
 */
@Module({
  controllers: [AuditController],
  providers: [AuditService, { provide: AUDIT_STORE, useFactory: () => new InMemoryAuditStore() }],
  exports: [AUDIT_STORE],
})
export class AuditModule {}
