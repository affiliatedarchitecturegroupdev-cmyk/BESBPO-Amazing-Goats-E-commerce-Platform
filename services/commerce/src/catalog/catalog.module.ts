import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CATALOGUE_STORE, CatalogService, seedCatalogueStore } from './catalog.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, { provide: CATALOGUE_STORE, useFactory: seedCatalogueStore }],
})
export class CatalogModule {}
