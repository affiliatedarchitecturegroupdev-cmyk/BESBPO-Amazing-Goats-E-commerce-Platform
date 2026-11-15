import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { RefundsService } from './refunds.service';
import { Refund } from './refunds.types';

interface RequestRefundBody {
  id: string;
  paymentId: string;
  amountCents: number;
  reason: string;
}

@Controller('payments/refunds')
export class RefundsController {
  constructor(private readonly service: RefundsService) {}

  @Get()
  @RequirePermissions('refunds:request')
  list(): Promise<Refund[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('refunds:request')
  get(@Param('id') id: string): Promise<Refund> {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('refunds:request')
  request(@Body() body: RequestRefundBody, @Req() req: unknown): Promise<Refund> {
    const requester = userFromRequest(req)?.id ?? '';
    return this.service.request({ ...body, requestedBy: requester });
  }

  /** Approve; above the limit the approver must differ from the requester. */
  @Post(':id/approve')
  @RequirePermissions('refunds:approve')
  approve(@Param('id') id: string, @Req() req: unknown): Promise<Refund> {
    const approver = userFromRequest(req)?.id ?? '';
    return this.service.approve(id, approver);
  }
}
