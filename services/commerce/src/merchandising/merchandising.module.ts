import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MerchandisingController } from './merchandising.controller';
import { MERCHANDISING_STORE, MerchandisingService } from './merchandising.service';
import { InMemoryMerchandisingStore } from './merchandising.store';

@Module({
  imports: [CatalogModule],
  controllers: [MerchandisingController],
  providers: [
    MerchandisingService,
    { provide: MERCHANDISING_STORE, useFactory: () => new InMemoryMerchandisingStore() },
  ],
  exports: [MerchandisingService],
})
export class MerchandisingModule {}
