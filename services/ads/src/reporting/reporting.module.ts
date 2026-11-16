import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { ReportingService, REPORTING_STORE } from './reporting.service';
import { InMemoryReportingStore } from './reporting.store';

@Module({
  controllers: [ReportingController],
  providers: [
    ReportingService,
    { provide: REPORTING_STORE, useFactory: () => new InMemoryReportingStore() },
  ],
  exports: [REPORTING_STORE, ReportingService],
})
export class ReportingModule {}
