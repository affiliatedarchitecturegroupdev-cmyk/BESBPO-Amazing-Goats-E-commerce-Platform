import { Module } from '@nestjs/common';
import { selectStore } from '@ag/db';
import type { Db } from '@ag/db';
import { AG_DB } from '@ag/nest-db';
import { OrdersController } from './orders.controller';
import { MyOrdersController } from './my-orders.controller';
import { OrdersService, ORDER_STORE, CYCLE_SOURCE } from './orders.service';
import { InMemoryOrderStore, OrderStore } from './orders.store';
import { PgOrderStore } from './orders.sql-store';
import { CyclesModule } from '../cycles/cycles.module';
import { CYCLE_STORE } from '../cycles/cycles.service';

@Module({
  imports: [CyclesModule],
  controllers: [OrdersController, MyOrdersController],
  providers: [
    OrdersService,
    {
      provide: ORDER_STORE,
      useFactory: (db?: Db) =>
        selectStore<OrderStore>(new InMemoryOrderStore(), () => new PgOrderStore(db!)),
      inject: [{ token: AG_DB, optional: true }],
    },
    { provide: CYCLE_SOURCE, useExisting: CYCLE_STORE },
  ],
})
export class OrdersModule {}
