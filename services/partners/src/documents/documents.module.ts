import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { InMemoryPartnerStore, PartnerStore, PARTNER_STORE } from '../partner.store';
import { PgPartnerStore } from '../partner.sql-store';

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    {
      provide: PARTNER_STORE,
      useFactory: (db?: Db) =>
        selectStore<PartnerStore>(new InMemoryPartnerStore(), () => new PgPartnerStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class DocumentsModule {}
