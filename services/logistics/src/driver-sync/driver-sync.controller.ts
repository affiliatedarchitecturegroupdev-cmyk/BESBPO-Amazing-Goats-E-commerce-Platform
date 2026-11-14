import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { DriverSyncService } from './driver-sync.service';
import { DeliveryStatus, DriverEvent, ReceiveResult } from './driver-sync.types';

interface SyncBody {
  events: DriverEvent[];
}

@Controller('logistics/driver-sync')
export class DriverSyncController {
  constructor(private readonly service: DriverSyncService) {}

  @Get()
  @RequirePermissions('delivery:execute')
  list(): Promise<DriverEvent[]> {
    return this.service.list();
  }

  @Post()
  @RequirePermissions('delivery:execute')
  receive(@Body() body: SyncBody): Promise<ReceiveResult> {
    return this.service.receive(body?.events ?? []);
  }

  @Get('stops/:stopId/status')
  @RequirePermissions('delivery:execute')
  status(@Param('stopId') stopId: string): Promise<DeliveryStatus> {
    return this.service.deliveryStatus(stopId);
  }
}
