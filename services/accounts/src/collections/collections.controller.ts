import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { CollectionsService } from './collections.service';
import { CollectionActionRecord } from './collections.types';

interface ScheduleBody {
  invoiceId: string;
  dueOn: string;
}

@Controller('accounts/collections')
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}

  @Get()
  @RequirePermissions('credit:write')
  list(): Promise<CollectionActionRecord[]> {
    return this.service.list();
  }

  /** The steps due by a date, for the collections worker. */
  @Get('due')
  @RequirePermissions('credit:write')
  due(@Query('asOf') asOf: string): Promise<CollectionActionRecord[]> {
    return this.service.due(asOf);
  }

  @Post('schedule')
  @RequirePermissions('invoices:write')
  schedule(@Body() body: ScheduleBody): Promise<CollectionActionRecord[]> {
    return this.service.schedule(body.invoiceId, body.dueOn);
  }

  @Post(':id/done')
  @RequirePermissions('credit:write')
  markDone(@Param('id') id: string, @Req() req: unknown): Promise<CollectionActionRecord> {
    const byUser = userFromRequest(req)?.id ?? '';
    return this.service.markDone(id, byUser, new Date().toISOString());
  }
}
