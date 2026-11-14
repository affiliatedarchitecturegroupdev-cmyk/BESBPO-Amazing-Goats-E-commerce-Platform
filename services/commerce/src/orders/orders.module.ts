import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService, ORDER_STORE, CYCLE_SOURCE } from './orders.service';
import { InMemoryOrderStore } from './orders.store';
import { CyclesModule } from '../cycles/cycles.module';
import { CYCLE_STORE } from '../cycles/cycles.service';

@Module({
  imports: [CyclesModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    { provide: ORDER_STORE, useFactory: () => new InMemoryOrderStore() },
    { provide: CYCLE_SOURCE, useExisting: CYCLE_STORE },
  ],
})
export class OrdersModule {}
