import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { BatchesService } from './batches.service';
import { Batch, BatchInput, PackSpec } from './batches.types';

interface ReceiveBody extends BatchInput {
  packs: PackSpec[];
}

@Controller('stock/batches')
export class BatchesController {
  constructor(private readonly service: BatchesService) {}

  @Get()
  @RequirePermissions('stock:read')
  list(): Promise<Batch[]> {
    return this.service.list();
  }

  @Get('sellable/:sku')
  @RequirePermissions('stock:read')
  sellable(@Param('sku') sku: string): Promise<Batch[]> {
    return this.service.sellable(sku);
  }

  @Get(':id')
  @RequirePermissions('stock:read')
  get(@Param('id') id: string): Promise<Batch> {
    return this.service.get(id);
  }

  @Post('receive')
  @RequirePermissions('stock:write')
  receive(@Body() body: ReceiveBody): Promise<Batch[]> {
    const { packs, ...input } = body;
    return this.service.receive(input, packs);
  }

  @Post(':id/release')
  @RequirePermissions('stock:write')
  release(@Param('id') id: string): Promise<Batch> {
    return this.service.release(id);
  }
}
