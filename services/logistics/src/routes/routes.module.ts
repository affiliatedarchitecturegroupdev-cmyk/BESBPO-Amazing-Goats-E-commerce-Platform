import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { RoutesController } from './routes.controller';
import { RoutesService, ROUTE_STORE } from './routes.service';
import { InMemoryRouteStore, RouteStore } from './routes.store';
import { PgRouteStore } from './routes.sql-store';
import { SlotsModule } from '../slots/slots.module';

@Module({
  imports: [SlotsModule],
  controllers: [RoutesController],
  providers: [
    RoutesService,
    {
      provide: ROUTE_STORE,
      useFactory: (db?: Db) =>
        selectStore<RouteStore>(new InMemoryRouteStore(), () => new PgRouteStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
  ],
  exports: [ROUTE_STORE],
})
export class RoutesModule {}
