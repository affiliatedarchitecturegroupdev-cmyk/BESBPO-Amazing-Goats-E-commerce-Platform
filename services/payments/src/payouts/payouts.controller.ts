import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { RequirePermissions, userFromRequest } from '@ag/nest-auth';
import { PayoutsService } from './payouts.service';
import { Payout } from './payouts.types';

interface RequestPayoutBody {
  id: string;
  payeeOrgId: string;
  amountCents: number;
  provider?: string;
}

@Controller('payments/payouts')
export class PayoutsController {
  constructor(private readonly service: PayoutsService) {}

  @Get()
  @RequirePermissions('payouts:request')
  list(): Promise<Payout[]> {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions('payouts:request')
  get(@Param('id') id: string): Promise<Payout> {
    return this.service.get(id);
  }

  @Post()
  @RequirePermissions('payouts:request')
  request(@Body() body: RequestPayoutBody, @Req() req: unknown): Promise<Payout> {
    const requester = userFromRequest(req)?.id ?? '';
    return this.service.request({ ...body, requestedBy: requester });
  }

  /** Approve; above the limit the approver must differ from the requester. */
  @Post(':id/approve')
  @RequirePermissions('payouts:approve')
  approve(@Param('id') id: string, @Req() req: unknown): Promise<Payout> {
    const approver = userFromRequest(req)?.id ?? '';
    return this.service.approve(id, approver);
  }
}
