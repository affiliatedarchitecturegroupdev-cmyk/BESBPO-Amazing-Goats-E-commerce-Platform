import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { InvoicesController } from './invoices.controller';
import { InvoicesService, INVOICES_STORE } from './invoices.service';
import { InMemoryInvoicesStore, InvoicesStore } from './invoices.store';
import { PgInvoicesStore } from './invoices.sql-store';

@Module({
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    {
      provide: INVOICES_STORE,
      useFactory: (db?: Db) =>
        selectStore<InvoicesStore>(new InMemoryInvoicesStore(), () => new PgInvoicesStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [INVOICES_STORE, InvoicesService],
})
export class InvoicesModule {}
