import { Module } from '@nestjs/common';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService, RECONCILIATION_STORE } from './reconciliation.service';
import { InMemoryReconciliationStore } from './reconciliation.store';

@Module({
  controllers: [ReconciliationController],
  providers: [
    ReconciliationService,
    { provide: RECONCILIATION_STORE, useFactory: () => new InMemoryReconciliationStore() },
  ],
})
export class ReconciliationModule {}
