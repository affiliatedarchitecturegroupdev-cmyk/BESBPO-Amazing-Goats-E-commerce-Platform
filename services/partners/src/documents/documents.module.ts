import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { InMemoryPartnerStore, PARTNER_STORE } from '../partner.store';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, { provide: PARTNER_STORE, useFactory: () => new InMemoryPartnerStore() }],
})
export class DocumentsModule {}
