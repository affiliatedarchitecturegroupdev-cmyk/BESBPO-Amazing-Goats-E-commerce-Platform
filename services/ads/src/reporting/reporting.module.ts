import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { ReportingController } from './reporting.controller';
import { ReportingService, REPORTING_STORE } from './reporting.service';
import { InMemoryReportingStore, ReportingStore } from './reporting.store';
import { PgReportingStore } from './reporting.sql-store';

@Module({
  controllers: [ReportingController],
  providers: [
    ReportingService,
    {
      provide: REPORTING_STORE,
      useFactory: (db?: Db) =>
        selectStore<ReportingStore>(new InMemoryReportingStore(), () => new PgReportingStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [REPORTING_STORE, ReportingService],
})
export class ReportingModule {}
