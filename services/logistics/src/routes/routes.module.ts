import { Module } from '@nestjs/common';
import { RoutesController } from './routes.controller';
import { RoutesService, ROUTE_STORE } from './routes.service';
import { InMemoryRouteStore } from './routes.store';
import { SlotsModule } from '../slots/slots.module';

@Module({
  imports: [SlotsModule],
  controllers: [RoutesController],
  providers: [RoutesService, { provide: ROUTE_STORE, useFactory: () => new InMemoryRouteStore() }],
})
export class RoutesModule {}
