import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '@ag/nest-auth';
import { RecallsService } from './recalls.service';
import { Recall, RecallInput, RecallPlan } from './recalls.domain';

@Controller('stock/recalls')
export class RecallsController {
  constructor(private readonly service: RecallsService) {}

  @Get()
  @RequirePermissions('batches:recall')
  list(): Promise<Recall[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('batches:recall')
  get(@Param('id') id: string): Promise<Recall> {
    return this.service.get(id);
  }

  @Get('plan/:batchId')
  @RequirePermissions('batches:recall')
  plan(@Param('batchId') batchId: string): Promise<RecallPlan> {
    return this.service.plan(batchId);
  }

  @Post()
  @RequirePermissions('batches:recall')
  open(@Body() input: RecallInput): Promise<Recall> {
    return this.service.open(input);
  }

  @Post(':id/close')
  @RequirePermissions('batches:recall')
  close(@Param('id') id: string): Promise<Recall> {
    return this.service.close(id);
  }
}
