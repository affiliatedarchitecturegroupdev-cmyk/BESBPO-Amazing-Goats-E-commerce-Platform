import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { ProofOfDeliveryController } from './proof-of-delivery.controller';
import { ProofOfDeliveryService, PROOF_OF_DELIVERY_STORE } from './proof-of-delivery.service';
import { InMemoryProofOfDeliveryStore, ProofOfDeliveryStore } from './proof-of-delivery.store';
import { PgProofOfDeliveryStore } from './proof-of-delivery.sql-store';

@Module({
  controllers: [ProofOfDeliveryController],
  providers: [
    ProofOfDeliveryService,
    {
      provide: PROOF_OF_DELIVERY_STORE,
      useFactory: (db?: Db) =>
        selectStore<ProofOfDeliveryStore>(
          new InMemoryProofOfDeliveryStore(),
          () => new PgProofOfDeliveryStore(db!),
        ),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [PROOF_OF_DELIVERY_STORE],
})
export class ProofOfDeliveryModule {}
