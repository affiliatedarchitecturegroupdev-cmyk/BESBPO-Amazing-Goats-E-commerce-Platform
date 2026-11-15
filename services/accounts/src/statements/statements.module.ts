import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { StatementsController } from './statements.controller';
import { StatementsService, STATEMENTS_INVOICES_STORE } from './statements.service';
import { InMemoryInvoicesStore, InvoicesStore } from '../invoices/invoices.store';
import { PgInvoicesStore } from '../invoices/invoices.sql-store';

@Module({
  controllers: [StatementsController],
  providers: [
    StatementsService,
    {
      provide: STATEMENTS_INVOICES_STORE,
      useFactory: (db?: Db) =>
        selectStore<InvoicesStore>(new InMemoryInvoicesStore(), () => new PgInvoicesStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
})
export class StatementsModule {}
