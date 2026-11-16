import { Module } from '@nestjs/common';
import { CreativesController } from './creatives.controller';
import { CreativesService } from './creatives.service';
import { AdsStoresModule } from '../ads-stores.module';

@Module({
  imports: [AdsStoresModule],
  controllers: [CreativesController],
  providers: [CreativesService],
  exports: [CreativesService],
})
export class CreativesModule {}
